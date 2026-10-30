const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

// ==========================================
// 1. TEST BACKEND AND DATABASE CONNECTION
// ==========================================

app.get("/api", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      message: "College Library API is running!",
      database: "Connected successfully"
    });
  } catch (error) {
    console.error("Database connection error:", error.message);
    res.status(500).json({ error: "Database connection failed." });
  }
});

// ==========================================
// 2. GET ALL BOOKS
// ==========================================

app.get("/api/books", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        b.book_id,
        b.book_title,
        b.author,
        c.category_name,
        b.published_year,
        b.total_copies,
        b.total_copies - COALESCE(
          SUM(
            CASE
              WHEN i.return_date IS NULL THEN 1
              ELSE 0
            END
          ), 0
        ) AS available_copies
      FROM Books b
      LEFT JOIN Categories c
        ON b.category_id = c.category_id
      LEFT JOIN IssueRecords i
        ON b.book_id = i.book_id
      GROUP BY
        b.book_id,
        b.book_title,
        b.author,
        c.category_name,
        b.published_year,
        b.total_copies
      ORDER BY b.book_id
    `);

    res.json(rows);
  } catch (error) {
    console.error("Get books error:", error.message);
    res.status(500).json({ error: "Unable to retrieve books." });
  }
});

// ==========================================
// 3. GET ALL MEMBERS
// ==========================================

app.get("/api/members", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM Members ORDER BY member_id"
    );

    res.json(rows);
  } catch (error) {
    console.error("Get members error:", error.message);
    res.status(500).json({ error: "Unable to retrieve members." });
  }
});

// ==========================================
// 4. GET ALL ISSUE RECORDS
// ==========================================

app.get("/api/issues", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        i.issue_id,
        i.book_id,
        i.member_id,
        m.member_name,
        b.book_title,
        i.issue_date,
        i.due_date,
        i.return_date,
        CASE
          WHEN i.return_date IS NOT NULL THEN 'Returned'
          WHEN i.due_date < CURDATE() THEN 'Overdue'
          ELSE 'Issued'
        END AS issue_status
      FROM IssueRecords i
      JOIN Members m
        ON i.member_id = m.member_id
      JOIN Books b
        ON i.book_id = b.book_id
      ORDER BY i.issue_id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Get issues error:", error.message);
    res.status(500).json({
      error: "Unable to retrieve issue records."
    });
  }
});

// ==========================================
// 5. ISSUE A BOOK USING IssueBook PROCEDURE
// ==========================================

app.post("/api/issues", async (req, res) => {
  const { book_id, member_id, issue_date, due_date } = req.body;

  const bookId = Number(book_id);
  const memberId = Number(member_id);

  if (
    !Number.isInteger(bookId) ||
    bookId <= 0 ||
    !Number.isInteger(memberId) ||
    memberId <= 0 ||
    !issue_date ||
    !due_date
  ) {
    return res.status(400).json({
      error: "Please provide valid book ID, member ID, issue date and due date."
    });
  }

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (
    !datePattern.test(issue_date) ||
    !datePattern.test(due_date)
  ) {
    return res.status(400).json({
      error: "Dates must use YYYY-MM-DD format."
    });
  }

  if (due_date < issue_date) {
    return res.status(400).json({
      error: "Due date cannot be before the issue date."
    });
  }

  try {
    await pool.query(
      "CALL IssueBook(?, ?, ?, ?)",
      [bookId, memberId, issue_date, due_date]
    );

    res.status(201).json({
      message: "Book issued successfully!"
    });
  } catch (error) {
    console.error("Issue book error:", error.message);

    if (error.sqlState === "45000") {
      return res.status(400).json({
        error: error.message
      });
    }

    res.status(500).json({
      error: "Unable to issue the book. Check the stored procedure and database."
    });
  }
});

// ==========================================
// 6. RETURN A BOOK USING ReturnBook PROCEDURE
// ==========================================

app.put("/api/issues/:id/return", async (req, res) => {
  const issueId = Number(req.params.id);

  const returnDate =
    req.body?.return_date ||
    new Date().toISOString().slice(0, 10);

  if (!Number.isInteger(issueId) || issueId <= 0) {
    return res.status(400).json({
      error: "Invalid issue ID."
    });
  }

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(returnDate)) {
    return res.status(400).json({
      error: "Return date must use YYYY-MM-DD format."
    });
  }

  try {
    await pool.query(
      "CALL ReturnBook(?, ?)",
      [issueId, returnDate]
    );

    res.json({
      message: "Book returned successfully!"
    });
  } catch (error) {
    console.error("Return book error:", error.message);

    if (error.sqlState === "45000") {
      return res.status(400).json({
        error: error.message
      });
    }

    res.status(500).json({
      error: "Unable to return the book. Check the stored procedure and database."
    });
  }
});

// ==========================================
// 7. GET DASHBOARD STATISTICS
// ==========================================

app.get("/api/stats", async (req, res) => {
  try {
    const [[books]] = await pool.query(`
      SELECT COUNT(*) AS total_books
      FROM Books
    `);

    const [[members]] = await pool.query(`
      SELECT COUNT(*) AS total_members
      FROM Members
    `);

    const [[issues]] = await pool.query(`
      SELECT COUNT(*) AS total_issues
      FROM IssueRecords
    `);

    const [[active]] = await pool.query(`
      SELECT COUNT(*) AS active_issues
      FROM IssueRecords
      WHERE return_date IS NULL
    `);

    const [[returned]] = await pool.query(`
      SELECT COUNT(*) AS returned_books
      FROM IssueRecords
      WHERE return_date IS NOT NULL
    `);

    res.json({
      ...books,
      ...members,
      ...issues,
      ...active,
      ...returned
    });
  } catch (error) {
    console.error("Dashboard stats error:", error.message);

    res.status(500).json({
      error: "Unable to retrieve dashboard statistics."
    });
  }
});

// ==========================================
// 8. START THE SERVER
// ==========================================

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});