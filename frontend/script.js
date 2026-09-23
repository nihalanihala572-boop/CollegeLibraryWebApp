const API = "http://localhost:5000/api";
let books = [];

async function loadStats() {
  const data = await fetch(`${API}/stats`).then(r => r.json());
  totalBooks.textContent = data.total_books;
  totalMembers.textContent = data.total_members;
  totalIssues.textContent = data.total_issues;
  activeIssues.textContent = data.active_issues;
}

async function loadBooks() {
  books = await fetch(`${API}/books`).then(r => r.json());
  renderBooks(books);
}

function renderBooks(data) {
  booksTable.innerHTML = data.map(b => `
    <tr>
      <td>${b.book_id}</td><td>${b.book_title}</td><td>${b.author}</td>
      <td>${b.category_name}</td><td>${b.available_copies}</td>
    </tr>`).join("");
}

function filterBooks() {
  const q = search.value.toLowerCase();
  renderBooks(books.filter(b =>
    b.book_title.toLowerCase().includes(q) ||
    b.author.toLowerCase().includes(q)
  ));
}

async function loadIssues() {
  const issues = await fetch(`${API}/issues`).then(r => r.json());

  issuesTable.innerHTML = issues.map(i => `
    <tr>
      <td>${i.issue_id}</td>
      <td>${i.member_name}</td>
      <td>${i.book_title}</td>
      <td>${i.issue_date.slice(0, 10)}</td>
      <td>${i.due_date.slice(0, 10)}</td>
      <td>${i.issue_status}</td>
      <td>
        ${i.return_date
          ? `<span class="returned-button">Returned</span>`
          : `<button onclick="returnBook(${i.issue_id})">Return</button>`}
      </td>
    </tr>
  `).join("");
}


issueForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    book_id: bookId.value,
    member_id: memberId.value,
    issue_date: issueDate.value,
    due_date: dueDate.value
  };
  const response = await fetch(`${API}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  message.textContent = data.message || data.error;
  if (response.ok) {
    issueForm.reset();
    refresh();
  }
});

async function returnBook(id) {
  const response = await fetch(`${API}/issues/${id}/return`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ return_date: new Date().toISOString().slice(0, 10) })
  });
  const data = await response.json();
  message.textContent = data.message || data.error;
  refresh();
}

async function refresh() {
  await Promise.all([loadStats(), loadBooks(), loadIssues()]);
}
refresh();
