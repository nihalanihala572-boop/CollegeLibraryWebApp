const API_URL = "http://localhost:5000/api";

let allBooks = [];
let allIssues = [];

// ==========================================
// 1. SAFELY DISPLAY DATABASE VALUES
// ==========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// ==========================================
// 2. FETCH DATA FROM BACKEND
// ==========================================

async function fetchData(endpoint) {
    const response = await fetch(`${API_URL}${endpoint}`);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Unable to load data.");
    }

    return data;
}

// ==========================================
// 3. FIND TABLES
// ==========================================

function findTable(requiredHeaders) {
    return [...document.querySelectorAll("table")].find(table => {
        const headers = [
            ...table.querySelectorAll("thead th, tr:first-child th")
        ].map(th => th.textContent.trim().toLowerCase());

        return requiredHeaders.every(header =>
            headers.some(item => item.includes(header))
        );
    });
}

function getTableBody(table) {
    if (!table) return null;

    let tbody = table.querySelector("tbody");

    if (!tbody) {
        tbody = document.createElement("tbody");
        table.appendChild(tbody);
    }

    return tbody;
}

// ==========================================
// 4. DASHBOARD STATISTICS
// ==========================================

function updateStat(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value ?? 0;
    }
}

async function loadStats() {
    try {
        const stats = await fetchData("/stats");

        updateStat("totalBooks", stats.total_books);
        updateStat("totalMembers", stats.total_members);
        updateStat("totalIssues", stats.total_issues);
        updateStat("activeIssues", stats.active_issues);

    } catch (error) {
        console.error("Dashboard statistics error:", error);
    }
}

// ==========================================
// 5. LOAD AND DISPLAY BOOKS
// ==========================================

async function loadBooks() {
    try {
        allBooks = await fetchData("/books");
        displayBooks(allBooks);

    } catch (error) {
        console.error("Unable to load books:", error);

        showTableError(
            ["title", "author", "category"],
            error.message
        );
    }
}

function displayBooks(books) {
    const table = findTable(["title", "author", "category"]);
    const tbody = getTableBody(table);

    if (!tbody) {
        console.error("Books table not found.");
        return;
    }

    if (books.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">No books found.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = books.map(book => `
        <tr>
            <td>${escapeHTML(book.book_id)}</td>
            <td>${escapeHTML(book.book_title)}</td>
            <td>${escapeHTML(book.author)}</td>
            <td>${escapeHTML(book.category_name)}</td>
            <td>${escapeHTML(book.available_copies)}</td>
        </tr>
    `).join("");
}

// ==========================================
// 6. SEARCH BOOKS
// ==========================================

function setupBookSearch() {
    const searchInput = [...document.querySelectorAll("input")]
        .find(input =>
            /search/i.test(input.placeholder) &&
            /title|author/i.test(input.placeholder)
        );

    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
        const term = searchInput.value.trim().toLowerCase();

        const filteredBooks = allBooks.filter(book =>
            String(book.book_title ?? "")
                .toLowerCase()
                .includes(term) ||
            String(book.author ?? "")
                .toLowerCase()
                .includes(term)
        );

        displayBooks(filteredBooks);
    });
}

// ==========================================
// 7. LOAD ISSUE RECORDS
// ==========================================

async function loadIssues() {
    try {
        allIssues = await fetchData("/issues");
        displayIssues(allIssues);

    } catch (error) {
        console.error("Unable to load issue records:", error);

        showTableError(
            ["member", "book", "issue date"],
            error.message
        );
    }
}

function displayIssues(issues) {
    const table = findTable(["member", "book", "issue date"]);
    const tbody = getTableBody(table);

    if (!tbody) {
        console.error("Issue records table not found.");
        return;
    }

    if (issues.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">No issue records found.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = issues.map(issue => {
        const status = issue.issue_status || "Issued";
        const returned = Boolean(issue.return_date);

        return `
            <tr>
                <td>${escapeHTML(issue.issue_id)}</td>
                <td>${escapeHTML(issue.member_name)}</td>
                <td>${escapeHTML(issue.book_title)}</td>
                <td>${escapeHTML(formatDate(issue.issue_date))}</td>
                <td>${escapeHTML(formatDate(issue.due_date))}</td>
                <td>
                    <span class="status-${status.toLowerCase()}">
                        ${escapeHTML(status)}
                    </span>
                </td>
                <td>
                    ${
                        returned
                            ? '<span class="status-returned">Returned</span>'
                            : `<button
                                type="button"
                                class="return-book-btn"
                                data-issue-id="${Number(issue.issue_id)}">
                                Return
                               </button>`
                    }
                </td>
            </tr>
        `;
    }).join("");
}

// ==========================================
// 8. FORMAT DATES
// ==========================================

function formatDate(date) {
    if (!date) return "—";

    const value = String(date).slice(0, 10);
    const parts = value.split("-");

    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    return value;
}

function getLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// ==========================================
// 9. DISPLAY TABLE ERRORS
// ==========================================

function showTableError(headers, message) {
    const table = findTable(headers);
    const tbody = getTableBody(table);

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    Unable to load data: ${escapeHTML(message)}
                </td>
            </tr>
        `;
    }
}

// ==========================================
// 10. ISSUE A BOOK
// ==========================================

function setupIssueForm() {
    const inputs = [...document.querySelectorAll("input")];

    function findInput(keywords) {
        return inputs.find(input => {
            const text = [
                input.id,
                input.name,
                input.placeholder,
                input.getAttribute("aria-label")
            ].filter(Boolean).join(" ").toLowerCase();

            return keywords.some(keyword => text.includes(keyword));
        });
    }

    function findDateInput(keywords) {
        return inputs.find(input => {
            if (input.type !== "date") return false;

            const labels = input.labels
                ? [...input.labels]
                    .map(label => label.textContent)
                    .join(" ")
                : "";

            const text = [
                input.id,
                input.name,
                input.placeholder,
                input.getAttribute("aria-label"),
                labels,
                input.previousElementSibling?.textContent || ""
            ].filter(Boolean).join(" ").toLowerCase();

            return keywords.some(keyword => text.includes(keyword));
        });
    }

    const bookInput = findInput(["book id", "book_id"]);
    const memberInput = findInput(["member id", "member_id"]);

    const dateInputs = inputs.filter(input => input.type === "date");

    const issueDateInput =
        findDateInput(["issue date", "issue_date"]) || dateInputs[0];

    const dueDateInput =
        findDateInput(["due date", "due_date"]) ||
        dateInputs.find(input => input !== issueDateInput);

    const issueButton = [...document.querySelectorAll("button")]
        .find(button =>
            button.textContent.trim().toLowerCase() === "issue book"
        );

    if (
        !bookInput ||
        !memberInput ||
        !issueDateInput ||
        !dueDateInput ||
        !issueButton
    ) {
        console.error("Issue form elements could not be identified.", {
            bookInput,
            memberInput,
            issueDateInput,
            dueDateInput,
            issueButton
        });

        return;
    }

    const submitIssue = async event => {
        event.preventDefault();

        const book_id = bookInput.value.trim();
        const member_id = memberInput.value.trim();
        const issue_date = issueDateInput.value;
        const due_date = dueDateInput.value;

        console.log("Issue form values:", {
            book_id,
            member_id,
            issue_date,
            due_date
        });

        if (!book_id || !member_id || !issue_date || !due_date) {
            alert(
                "Please enter Book ID, Member ID, Issue Date and Due Date."
            );
            return;
        }

        if (
            !Number.isInteger(Number(book_id)) ||
            Number(book_id) <= 0 ||
            !Number.isInteger(Number(member_id)) ||
            Number(member_id) <= 0
        ) {
            alert("Enter valid Book ID and Member ID numbers.");
            return;
        }

        if (due_date < issue_date) {
            alert("Due Date cannot be earlier than Issue Date.");
            return;
        }

        issueButton.disabled = true;

        try {
            const response = await fetch(`${API_URL}/issues`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    book_id: Number(book_id),
                    member_id: Number(member_id),
                    issue_date,
                    due_date
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error || "Unable to issue book."
                );
            }

            alert(result.message || "Book issued successfully!");

            bookInput.value = "";
            memberInput.value = "";
            issueDateInput.value = "";
            dueDateInput.value = "";

            await Promise.all([
                loadStats(),
                loadBooks(),
                loadIssues()
            ]);

        } catch (error) {
            console.error("Issue book error:", error);
            alert(error.message);

        } finally {
            issueButton.disabled = false;
        }
    };

    const form = issueButton.closest("form");

    if (form) {
        form.addEventListener("submit", submitIssue);
    } else {
        issueButton.addEventListener("click", submitIssue);
    }
}

// ==========================================
// 11. RETURN A BOOK
// ==========================================

document.addEventListener("click", async event => {
    const button = event.target.closest(".return-book-btn");

    if (!button) return;

    const issueId = button.dataset.issueId;

    if (!issueId) {
        alert("Issue ID is missing.");
        return;
    }

    if (!confirm("Are you sure you want to return this book?")) {
        return;
    }

    button.disabled = true;

    try {
        const response = await fetch(
            `${API_URL}/issues/${encodeURIComponent(issueId)}/return`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    return_date: getLocalDate()
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Unable to return book."
            );
        }

        alert(result.message || "Book returned successfully!");

        await Promise.all([
            loadStats(),
            loadBooks(),
            loadIssues()
        ]);

    } catch (error) {
        console.error("Return book error:", error);
        alert(error.message);

    } finally {
        button.disabled = false;
    }
});

// ==========================================
// 12. LOAD EVERYTHING WHEN PAGE OPENS
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    await Promise.all([
        loadStats(),
        loadBooks(),
        loadIssues()
    ]);

    setupBookSearch();
    setupIssueForm();
});