import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import StatCard from "../components/Cards/StatCard.jsx";
import DashboardCharts from "../components/Dashboard/DashboardCharts.jsx";
import DashboardHero from "../components/Dashboard/DashboardHero.jsx";
import DashboardWidget from "../components/Dashboard/DashboardWidget.jsx";
import MoneyFlowComparison from "../components/Dashboard/MoneyFlowComparison.jsx";

const quotes = [
  "Every penny deserves a candy jar.",
  "Sweet savings start with tracking.",
  "Candyserver is running smoothly.",
  "Small treats, tidy totals, happier tomorrows.",
  "A well-stocked vault starts one entry at a time.",
];
const pageQuote = quotes[Math.floor(Math.random() * quotes.length)];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatActivityDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

async function requestJson(path, signal) {
  return api.get(path, { signal });
}

function Dashboard() {
  const [backendStatus, setBackendStatus] = useState("Checking");
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({
    total_expenses: 0,
    expense_count: 0,
    monthly_total: 0,
    recurring_expense_count: 0,
    estimated_monthly_recurring_total: 0,
  });
  const [documentSummary, setDocumentSummary] = useState({ total_documents: 0, total_storage_bytes: 0 });
  const [documents, setDocuments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [noteSummary, setNoteSummary] = useState({ total_notes: 0 });
  const [paySummary, setPaySummary] = useState({
    estimated_monthly_gross_income: 0,
    estimated_monthly_net_income: 0,
    estimated_monthly_taxes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      const [
        healthResult,
        expenseResult,
        summaryResult,
        documentSummaryResult,
        documentResult,
        noteResult,
        noteSummaryResult,
        paySummaryResult,
      ] = await Promise.allSettled([
        requestJson("/health", controller.signal),
        requestJson("/expenses", controller.signal),
        requestJson("/expenses/summary", controller.signal),
        requestJson("/documents/summary", controller.signal),
        requestJson("/documents", controller.signal),
        requestJson("/notes", controller.signal),
        requestJson("/notes/summary", controller.signal),
        requestJson("/pay-profiles/summary", controller.signal),
      ]);

      if (controller.signal.aborted) return;

      setBackendStatus(
        healthResult.status === "fulfilled" && healthResult.value?.status === "healthy"
          ? "healthy"
          : "Offline",
      );

      if (expenseResult.status === "fulfilled" && Array.isArray(expenseResult.value)) {
        setExpenses(expenseResult.value);
      }

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      }

      if (documentSummaryResult.status === "fulfilled") {
        setDocumentSummary(documentSummaryResult.value);
      }

      if (documentResult.status === "fulfilled" && Array.isArray(documentResult.value)) {
        setDocuments(documentResult.value);
      }

      if (noteResult.status === "fulfilled" && Array.isArray(noteResult.value)) {
        setNotes(noteResult.value);
      }

      if (noteSummaryResult.status === "fulfilled") {
        setNoteSummary(noteSummaryResult.value);
      }

      if (paySummaryResult.status === "fulfilled") {
        setPaySummary(paySummaryResult.value);
      }

      if (
        expenseResult.status === "rejected"
        || summaryResult.status === "rejected"
        || documentSummaryResult.status === "rejected"
        || documentResult.status === "rejected"
        || noteResult.status === "rejected"
        || noteSummaryResult.status === "rejected"
        || paySummaryResult.status === "rejected"
      ) {
        setDataError("Some sweets are still loading from candyserver. Try refreshing in a moment.");
      }

      setLoading(false);
    }

    loadDashboard();
    return () => controller.abort();
  }, []);

  const statusTone = backendStatus === "healthy"
    ? "healthy"
    : backendStatus === "Offline"
      ? "offline"
      : "checking";
  const estimatedRemaining = Number(paySummary.estimated_monthly_net_income) - Number(summary.monthly_total);
  const recentActivity = [
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      type: "expense",
      title: expense.description,
      category: expense.category,
      timestamp: expense.created_at,
      amount: expense.amount,
      recurring: expense.is_recurring,
    })),
    ...notes.map((note) => ({
      id: `note-${note.id}`,
      type: "note",
      title: note.title,
      category: note.category,
      timestamp: note.updated_at,
    })),
  ].sort((first, second) => new Date(second.timestamp) - new Date(first.timestamp)).slice(0, 5);

  return (
    <>
      <DashboardHero />

      {dataError && <div className="dashboard-notice" role="status">{dataError}</div>}

      <section className="stats-grid dashboard-stats-grid" aria-label="Live CandyVault summary">
        <StatCard label="Total Documents" value={String(documentSummary.total_documents)} detail="Files in the document jar" icon="DOC" />
        <StatCard label="Total Notes" value={String(noteSummary.total_notes)} detail="Ideas in the note jar" icon="TXT" />
        <StatCard label="Total Expenses" value={formatCurrency(summary.total_expenses)} detail="All-time candy jar total" icon="$" />
        <StatCard label="Estimated Monthly Gross" value={formatCurrency(paySummary.estimated_monthly_gross_income)} detail="Before estimated deductions" icon="GROSS" />
        <StatCard label="Estimated Monthly Net" value={formatCurrency(paySummary.estimated_monthly_net_income)} detail="Expected take-home pay candy" icon="NET" />
        <StatCard label="Monthly Taxes / Deductions" value={formatCurrency(paySummary.estimated_monthly_taxes)} detail="Planning estimate only" icon="TAX" />
        <StatCard label="Current Month Expenses" value={formatCurrency(summary.monthly_total)} detail="This month's sweet spend" icon="OUT" />
        <StatCard label="Remaining Net This Month" value={formatCurrency(estimatedRemaining)} detail="Candy left after expenses" icon="LEFT" />
        <StatCard label="Expense Count" value={String(summary.expense_count)} detail="Treats tracked in the vault" icon="#" />
        <StatCard label="Recurring Expenses" value={String(summary.recurring_expense_count)} detail="Repeating payments in the jar" icon="RE" />
        <StatCard label="Recurring Monthly Estimate" value={formatCurrency(summary.estimated_monthly_recurring_total)} detail="Normalized repeating expenses" icon="AUTO" />
        <StatCard label="Backend Status" value={backendStatus} detail="candyserver health" icon="API" statusTone={statusTone} />
      </section>

      <MoneyFlowComparison
        grossIncome={paySummary.estimated_monthly_gross_income}
        netIncome={paySummary.estimated_monthly_net_income}
        taxes={paySummary.estimated_monthly_taxes}
        expenses={summary.monthly_total}
        loading={loading}
      />

      <DashboardCharts
        expenses={expenses}
        documents={documents}
        totalStorageBytes={documentSummary.total_storage_bytes}
        loading={loading}
      />

      <div className="dashboard-widget-grid">
        <DashboardWidget title="Recent Activity" kicker="Expenses & notes" tone="blue" className="widget-wide">
          {loading ? (
            <div className="widget-state">Unwrapping the latest activity…</div>
          ) : recentActivity.length === 0 ? (
            <div className="mini-empty-state">
              <span aria-hidden="true">🍬</span>
              <div>
                <strong>Looks like this candy jar is empty.</strong>
                <p>Add an expense or note and its story will appear here.</p>
              </div>
            </div>
          ) : (
            <div className="activity-feed">
              {recentActivity.map((item) => (
                <article className="activity-item" key={item.id}>
                  <span className="activity-candy" aria-hidden="true">●</span>
                  <div className="activity-copy">
                    <strong>{item.type === "expense" ? item.recurring ? "Added recurring expense" : "Added expense" : "Saved note"}: {item.title}</strong>
                    <span>{item.category} · {formatActivityDate(item.timestamp)}</span>
                  </div>
                  <b>{item.type === "expense" ? formatCurrency(item.amount) : "NOTE"}</b>
                </article>
              ))}
            </div>
          )}
        </DashboardWidget>

        <DashboardWidget title="Quick Add Expense" kicker="Fast lane" tone="pink">
          <div className="quick-add-widget">
            <div className="quick-add-icon" aria-hidden="true">+</div>
            <p>Ring up a new expense at the CandyVault counter.</p>
            <Link className="widget-action" to="/expenses">Add an expense <span aria-hidden="true">→</span></Link>
          </div>
        </DashboardWidget>

        <DashboardWidget title="Expense Summary" kicker="Live totals" tone="mint">
          <div className="widget-summary-list">
            <div><span>All time</span><strong>{formatCurrency(summary.total_expenses)}</strong></div>
            <div><span>This month</span><strong>{formatCurrency(summary.monthly_total)}</strong></div>
            <div><span>Entries</span><strong>{summary.expense_count}</strong></div>
          </div>
        </DashboardWidget>

        <DashboardWidget title="Backend Health" kicker="candyserver" tone="yellow">
          <div className="health-widget">
            <span className={`health-orb ${statusTone}`} aria-hidden="true" />
            <div>
              <strong>{backendStatus === "healthy" ? "All systems sweet" : backendStatus}</strong>
              <p>{backendStatus === "healthy" ? "candyserver is serving fresh data." : "The server needs a little attention."}</p>
            </div>
          </div>
        </DashboardWidget>

        <aside className="dashboard-quote" aria-label="CandyVault message">
          <span aria-hidden="true">“</span>
          <blockquote>{pageQuote}</blockquote>
          <small>— CandyVault counter wisdom</small>
        </aside>
      </div>
    </>
  );
}

export default Dashboard;
