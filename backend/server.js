const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/books", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT b.book_id, b.book_title, b.author, c.category_name,
             b.published_year, b.total_copies,
             b.total_copies - COALESCE(SUM(
               CASE WHEN i.return_date IS NULL THEN 1 ELSE 0 END
             ), 0) AS available_copies
      FROM Books b
      JOIN Categories c ON b.category_id = c.category_id
      LEFT JOIN IssueRecords i ON b.book_id = i.book_id
      GROUP BY b.book_id, b.book_title, b.author, c.category_name,
               b.published_year, b.total_copies
      ORDER BY b.book_id
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/members", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM Members ORDER BY member_id");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/issues", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT i.issue_id, m.member_name, b.book_title,
             i.issue_date, i.due_date, i.return_date,
             CASE
               WHEN i.return_date IS NOT NULL THEN 'Returned'
               WHEN i.due_date < CURDATE() THEN 'Overdue'
               ELSE 'Issued'
             END AS issue_status
      FROM IssueRecords i
      JOIN Members m ON i.member_id = m.member_id
      JOIN Books b ON i.book_id = b.book_id
      ORDER BY i.issue_id DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/issues", async (req, res) => {
  const { book_id, member_id, issue_date, due_date } = req.body;
  if (!book_id || !member_id || !issue_date || !due_date) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const [result] = await pool.query(`
      INSERT INTO IssueRecords
      (book_id, member_id, issue_date, due_date)
      VALUES (?, ?, ?, ?)
    `, [book_id, member_id, issue_date, due_date]);

    res.status(201).json({ message: "Book issued successfully", issue_id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/issues/:id/return", async (req, res) => {
  const { return_date } = req.body;
  try {
    const [result] = await pool.query(`
      UPDATE IssueRecords
      SET return_date = ?
      WHERE issue_id = ?
    `, [return_date || new Date().toISOString().slice(0, 10), req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Issue record not found." });
    }
    res.json({ message: "Book returned successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const [[books]] = await pool.query("SELECT COUNT(*) AS total_books FROM Books");
    const [[members]] = await pool.query("SELECT COUNT(*) AS total_members FROM Members");
    const [[issues]] = await pool.query("SELECT COUNT(*) AS total_issues FROM IssueRecords");
    const [[active]] = await pool.query(
      "SELECT COUNT(*) AS active_issues FROM IssueRecords WHERE return_date IS NULL"
    );
    res.json({ ...books, ...members, ...issues, ...active });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(5000, () => {
  console.log("Backend running at http://localhost:5000");
});
