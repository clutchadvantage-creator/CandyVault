import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api/client.js";
import StatCard from "../components/Cards/StatCard.jsx";
import FilterBar from "../components/Filters/FilterBar.jsx";
import PageIntro from "../components/Header/PageIntro.jsx";
import LinkedNotesPanel from "../components/Notes/LinkedNotesPanel.jsx";

const categories = ["Housing", "Food", "Transportation", "Utilities", "Health", "Entertainment", "Other"];
const defaultFilters = {
  search: "",
  category: "",
  start_date: "",
  end_date: "",
  recurring: "",
  history_days: "90",
  sort: "expense_date:desc",
};

function localDateValue() {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localNow.toISOString().slice(0, 10);
}

function emptyForm() {
  return {
    description: "",
    category: "",
    amount: "",
    expense_date: localDateValue(),
    is_recurring: false,
    recurrence_frequency: "",
    recurrence_notes: "",
  };
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({
    total_expenses: 0,
    expense_count: 0,
    monthly_total: 0,
    recurring_expense_count: 0,
    estimated_monthly_recurring_total: 0,
  });
  const [paySummary, setPaySummary] = useState({ estimated_monthly_net_income: 0 });
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [linkedNoteCounts, setLinkedNoteCounts] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [filters, setFilters] = useState({ ...defaultFilters });

  const fetchExpenseData = useCallback(async (signal) => {
    const query = new URLSearchParams();
    if (filters.search.trim()) query.set("search", filters.search.trim());
    if (filters.category) query.set("category", filters.category);
    if (filters.start_date) query.set("start_date", filters.start_date);
    if (filters.end_date) query.set("end_date", filters.end_date);
    if (filters.recurring) query.set("is_recurring", filters.recurring);
    if (filters.history_days) query.set("history_days", filters.history_days);
    const [sortBy, sortDir] = filters.sort.split(":");
    query.set("sort_by", sortBy);
    query.set("sort_dir", sortDir);

    const [expensesResponse, summaryResponse, linkedNotesResponse, paySummaryResponse] = await Promise.all([
      apiFetch(`/expenses?${query.toString()}`, { signal }),
      apiFetch("/expenses/summary", { signal }),
      apiFetch("/notes?linked_type=expense", { signal }),
      apiFetch("/pay-profiles/summary", { signal }),
    ]);

    if (!expensesResponse.ok || !summaryResponse.ok || !linkedNotesResponse.ok || !paySummaryResponse.ok) {
      throw new Error("Expense data could not be loaded.");
    }

    const [expenseData, summaryData, linkedNoteData, paySummaryData] = await Promise.all([
      expensesResponse.json(),
      summaryResponse.json(),
      linkedNotesResponse.json(),
      paySummaryResponse.json(),
    ]);

    if (!Array.isArray(expenseData) || !Array.isArray(linkedNoteData)) {
      throw new Error("The expense service returned an invalid response.");
    }

    return { expenseData, summaryData, linkedNoteData, paySummaryData };
  }, [filters]);

  const applyExpenseData = useCallback(({ expenseData, summaryData, linkedNoteData, paySummaryData }) => {
    setExpenses(expenseData);
    setSummary(summaryData);
    setPaySummary(paySummaryData);
    setLinkedNoteCounts(linkedNoteData.reduce((counts, note) => {
      counts[note.linked_id] = (counts[note.linked_id] || 0) + 1;
      return counts;
    }, {}));
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitialData() {
      try {
        applyExpenseData(await fetchExpenseData(controller.signal));
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError(requestError.message || "Expense data could not be loaded.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadInitialData();
    return () => controller.abort();
  }, [applyExpenseData, fetchExpenseData]);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  function updateFilter(event) {
    const { name, value } = event.target;
    setLoading(true);
    setError("");
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function clearFilters() {
    setLoading(true);
    setError("");
    setFilters({ ...defaultFilters });
  }

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
  }

  function startEditing(expense) {
    setForm({
      description: expense.description,
      category: expense.category,
      amount: String(expense.amount),
      expense_date: expense.expense_date,
      is_recurring: expense.is_recurring,
      recurrence_frequency: expense.recurrence_frequency || "",
      recurrence_notes: expense.recurrence_notes || "",
    });
    setEditingId(expense.id);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    const isEditing = editingId !== null;

    try {
      const response = await apiFetch(`/expenses${isEditing ? `/${editingId}` : ""}`, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          recurrence_frequency: form.is_recurring ? form.recurrence_frequency : null,
          recurrence_notes: form.is_recurring ? form.recurrence_notes || null : null,
        }),
      });

      if (!response.ok) {
        throw new Error(response.status === 422
          ? "Please check each field and enter a valid expense."
          : `The expense could not be ${isEditing ? "updated" : "saved"}.`);
      }

      const savedExpense = await response.json();
      if (selectedExpense?.id === savedExpense.id) setSelectedExpense(savedExpense);
      resetForm();
      setLoading(true);
      applyExpenseData(await fetchExpenseData());
      setSuccess(isEditing ? "Expense updated throughout CandyVault." : "Expense added to CandyVault.");
    } catch (requestError) {
      setError(requestError.message || "The expense could not be saved.");
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  }

  async function handleDelete(expense) {
    if (!window.confirm(`Delete expense "${expense.description}"? Its attached notes will remain stored.`)) return;

    setDeletingId(expense.id);
    setError("");
    setSuccess("");
    try {
      const response = await apiFetch(`/expenses/${expense.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("The expense could not be deleted.");
      if (editingId === expense.id) resetForm();
      if (selectedExpense?.id === expense.id) setSelectedExpense(null);
      setLoading(true);
      applyExpenseData(await fetchExpenseData());
      setSuccess("Expense removed. Totals and charts have been refreshed.");
    } catch (requestError) {
      setError(requestError.message || "The expense could not be deleted.");
    } finally {
      setLoading(false);
      setDeletingId(null);
    }
  }

  const handleLinkedNoteCountChange = useCallback((expenseId, count) => {
    setLinkedNoteCounts((current) => {
      const next = { ...current };
      if (count > 0) next[expenseId] = count;
      else delete next[expenseId];
      return next;
    });
  }, []);

  const activeFilterCount = [
    filters.search,
    filters.category,
    filters.start_date,
    filters.end_date,
    filters.recurring,
    filters.history_days !== defaultFilters.history_days ? "history-window" : "",
    filters.sort !== defaultFilters.sort ? filters.sort : "",
  ].filter(Boolean).length;

  return (
    <>
      <PageIntro
        eyebrow="Financial records"
        title="Expenses"
        description="Record personal expenses, review spending, and monitor the current month from one workspace."
      />

      <section className="stats-grid expense-summary-grid" aria-label="Expense summary">
        <StatCard label="Total Expenses" value={formatCurrency(summary.total_expenses)} detail="All recorded expenses" icon="$" />
        <StatCard label="Number of Expenses" value={String(summary.expense_count)} detail="Transactions recorded" icon="#" />
        <StatCard label="Current Month Total" value={formatCurrency(summary.monthly_total)} detail="Expenses dated this month" icon="MO" />
        <StatCard label="Recurring Expenses" value={String(summary.recurring_expense_count)} detail="Repeating payments marked active" icon="RE" />
        <StatCard label="Monthly Recurring Estimate" value={formatCurrency(summary.estimated_monthly_recurring_total)} detail="Normalized from recurring schedules" icon="AUTO" />
      </section>

      <section className="expense-money-strip" aria-label="Monthly money in and money out">
        <div><span>🍬 Net Money In</span><strong>{formatCurrency(paySummary.estimated_monthly_net_income)}</strong></div>
        <div><span>🧾 Money Out</span><strong>{formatCurrency(summary.monthly_total)}</strong></div>
        <div className={Number(paySummary.estimated_monthly_net_income) - Number(summary.monthly_total) < 0 ? "negative" : ""}><span>🍭 Candy Left in the Jar</span><strong>{formatCurrency(Number(paySummary.estimated_monthly_net_income) - Number(summary.monthly_total))}</strong></div>
      </section>

      <FilterBar activeCount={activeFilterCount} onClear={clearFilters}>
        <label className="filter-field filter-search-field">
          <span>Search</span>
          <input name="search" type="search" value={filters.search} onChange={updateFilter} placeholder="Description or category" />
        </label>
        <label className="filter-field">
          <span>Category</span>
          <select name="category" value={filters.category} onChange={updateFilter}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>From</span>
          <input name="start_date" type="date" value={filters.start_date} onChange={updateFilter} />
        </label>
        <label className="filter-field">
          <span>To</span>
          <input name="end_date" type="date" value={filters.end_date} onChange={updateFilter} />
        </label>
        <label className="filter-field">
          <span>Recurring</span>
          <select name="recurring" value={filters.recurring} onChange={updateFilter}>
            <option value="">All expenses</option>
            <option value="true">Recurring only</option>
            <option value="false">One-time only</option>
          </select>
        </label>
        <label className="filter-field">
          <span>History window</span>
          <select name="history_days" value={filters.history_days} onChange={updateFilter}>
            <option value="30">Last 30 days + recurring</option>
            <option value="90">Last 90 days + recurring</option>
            <option value="180">Last 180 days + recurring</option>
            <option value="365">Last year + recurring</option>
            <option value="">All history</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Sort</span>
          <select name="sort" value={filters.sort} onChange={updateFilter}>
            <option value="expense_date:desc">Newest expense</option>
            <option value="expense_date:asc">Oldest expense</option>
            <option value="amount:desc">Amount: high to low</option>
            <option value="amount:asc">Amount: low to high</option>
            <option value="category:asc">Category: A to Z</option>
            <option value="created_at:desc">Recently added</option>
          </select>
        </label>
      </FilterBar>

      {error && <div className="expense-alert" role="alert">{error}</div>}
      {success && <div className="document-success" role="status">{success}</div>}

      <div className="expense-layout">
        <section className="panel expense-form-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">{editingId !== null ? "Edit expense" : "Add expense"}</h2>
              <p className="panel-subtitle">{editingId !== null ? "Update this transaction everywhere in CandyVault." : "Enter a transaction for your vault."}</p>
            </div>
          </div>

          <form className="expense-form" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Description</span>
              <input name="description" value={form.description} onChange={updateField} maxLength="255" placeholder="e.g. Grocery run" required />
            </label>

            <label className="form-field">
              <span>Category</span>
              <select name="category" value={form.category} onChange={updateField} required>
                <option value="">Select a category</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>

            <label className="form-field">
              <span>Amount</span>
              <div className="amount-input">
                <span aria-hidden="true">$</span>
                <input name="amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={updateField} placeholder="0.00" required />
              </div>
            </label>

            <label className="form-field">
              <span>Expense date</span>
              <input name="expense_date" type="date" value={form.expense_date} onChange={updateField} required />
            </label>

            <div className="recurring-expense-fields">
              <label className="recurring-expense-toggle">
                <input name="is_recurring" type="checkbox" checked={form.is_recurring} onChange={updateField} />
                <span><strong>Recurring expense</strong><small>Mark this payment as one that repeats.</small></span>
              </label>
              {form.is_recurring && (
                <>
                  <label className="form-field">
                    <span>Repeats</span>
                    <select name="recurrence_frequency" value={form.recurrence_frequency} onChange={updateField} required>
                      <option value="">Select a schedule</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every two weeks</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Recurring notes</span>
                    <input name="recurrence_notes" value={form.recurrence_notes} onChange={updateField} maxLength="500" placeholder="e.g. Autopay on the 15th" />
                  </label>
                </>
              )}
            </div>

            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? "Saving…" : editingId !== null ? "Save changes" : "Add expense"}
            </button>
            {editingId !== null && <button className="secondary-button" type="button" onClick={resetForm}>Cancel edit</button>}
          </form>
        </section>

        <section className="panel expense-list-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Expense history</h2>
              <p className="panel-subtitle">{filters.history_days ? `Showing the last ${filters.history_days} days plus every recurring expense.` : "Showing all saved expense history."}</p>
            </div>
            <span className="panel-kicker">{expenses.length} shown · {summary.expense_count} total</span>
          </div>

          {loading ? (
            <div className="expense-state" role="status">Loading expenses…</div>
          ) : expenses.length === 0 ? (
            <div className="empty-state">
              <div>
                <div className="empty-state-mark" aria-hidden="true">$</div>
                <h3>{activeFilterCount ? "No candy matches that search." : "No expenses recorded"}</h3>
                <p>{activeFilterCount ? "Try loosening a filter or clearing the counter." : "Add your first expense using the form to begin tracking spending."}</p>
              </div>
            </div>
          ) : (
            <div className="expense-table-wrap">
              <table className="expense-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th className="amount-column">Amount</th>
                    <th className="attached-notes-heading">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="expense-description">
                        <span>{expense.description}</span>
                        {expense.is_recurring && <small className="recurring-expense-badge" title={expense.recurrence_notes || `Repeats ${expense.recurrence_frequency}`}>↻ {expense.recurrence_frequency}</small>}
                      </td>
                      <td><span className="category-pill">{expense.category}</span></td>
                      <td>{formatDate(expense.expense_date)}</td>
                      <td className="amount-column expense-amount">{formatCurrency(expense.amount)}</td>
                      <td className="attached-notes-cell expense-row-actions">
                        <button className="expense-edit-button" type="button" onClick={() => startEditing(expense)}>Edit</button>
                        <button className="expense-delete-button" type="button" onClick={() => handleDelete(expense)} disabled={deletingId === expense.id}>
                          {deletingId === expense.id ? "Deleting…" : "Delete"}
                        </button>
                        <button
                          className={`${linkedNoteCounts[expense.id] ? "attached-notes-button" : "add-note-button"}${selectedExpense?.id === expense.id ? " active" : ""}`}
                          type="button"
                          onClick={() => setSelectedExpense(expense)}
                        >
                          {linkedNoteCounts[expense.id] ? `Attached Notes (${linkedNoteCounts[expense.id]})` : "Add Note"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedExpense && (
        <LinkedNotesPanel
          key={`expense-${selectedExpense.id}`}
          linkedType="expense"
          linkedId={selectedExpense.id}
          title={`${selectedExpense.description} · ${formatCurrency(selectedExpense.amount)}`}
          onClose={() => setSelectedExpense(null)}
          onNotesChange={handleLinkedNoteCountChange}
        />
      )}
    </>
  );
}

export default Expenses;
