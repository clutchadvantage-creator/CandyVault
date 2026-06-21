import { useMemo } from "react";
import DashboardWidget from "./DashboardWidget.jsx";
import { useTheme } from "../../theme/useTheme.js";

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const fullCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatBytes(bytes) {
  const amount = Number(bytes) || 0;
  if (amount < 1024) return `${amount} B`;
  if (amount < 1024 ** 2) return `${(amount / 1024).toFixed(1)} KB`;
  if (amount < 1024 ** 3) return `${(amount / 1024 ** 2).toFixed(1)} MB`;
  return `${(amount / 1024 ** 3).toFixed(2)} GB`;
}

function expenseTotal(expenses, key) {
  return expenses
    .filter((expense) => expense.expense_date === key)
    .reduce((total, expense) => total + (Number(expense.amount) || 0), 0);
}

function BarChart({ data, emptyMessage }) {
  const maximum = Math.max(...data.map((item) => item.value), 0);
  const hasValues = maximum > 0;

  if (!hasValues) {
    return <div className="chart-empty"><span aria-hidden="true">🍬</span>{emptyMessage}</div>;
  }

  return (
    <div className="candy-bar-chart" role="img" aria-label={data.map((item) => `${item.fullLabel}: ${fullCurrency.format(item.value)}`).join(", ")}>
      {data.map((item) => (
        <div className="candy-bar-column" key={item.key} title={`${item.fullLabel}: ${fullCurrency.format(item.value)}`}>
          <span className="candy-bar-value">{item.value ? compactCurrency.format(item.value) : ""}</span>
          <div className="candy-bar-track">
            <i style={{ height: `${Math.max((item.value / maximum) * 100, item.value ? 6 : 0)}%` }} />
          </div>
          <b>{item.label}</b>
        </div>
      ))}
    </div>
  );
}

function classifyDocument(document) {
  const type = (document.content_type || "").toLowerCase();
  const name = (document.original_filename || "").toLowerCase();
  if (type.includes("pdf") || name.endsWith(".pdf")) return "PDF";
  if (type.startsWith("image/") || /\.(png|jpe?g)$/.test(name)) return "Images";
  if (/word|excel|spreadsheet|officedocument/.test(type) || /\.(docx?|xlsx?)$/.test(name)) return "Office";
  if (type.startsWith("text/") || name.endsWith(".txt")) return "Text";
  return "Other";
}

function StorageChart({ documents, totalStorageBytes, colors }) {
  const grouped = documents.reduce((totals, document) => {
    const label = classifyDocument(document);
    totals[label] = (totals[label] || 0) + (Number(document.file_size) || 0);
    return totals;
  }, {});
  const entries = Object.entries(grouped).filter(([, bytes]) => bytes > 0);
  const measuredTotal = entries.reduce((total, [, bytes]) => total + bytes, 0);
  const total = Number(totalStorageBytes) || measuredTotal;
  let cursor = 0;
  const stops = entries.map(([, bytes], index) => {
    const start = cursor;
    cursor += total ? (bytes / total) * 100 : 0;
    return `${colors[index % colors.length]} ${start}% ${cursor}%`;
  });
  const donutBackground = stops.length ? `conic-gradient(${stops.join(", ")})` : "var(--surface-secondary)";

  return (
    <div className="storage-chart">
      <div className="storage-donut" style={{ background: donutBackground }} role="img" aria-label={`${formatBytes(total)} total document storage used`}>
        <div><strong>{formatBytes(total)}</strong><span>used</span></div>
      </div>
      {entries.length ? (
        <div className="storage-legend">
          {entries.map(([label, bytes], index) => (
            <div key={label}>
              <i style={{ background: colors[index % colors.length] }} />
              <span>{label}</span>
              <strong>{formatBytes(bytes)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="storage-empty">The document candy jar is ready for its first file.</div>
      )}
    </div>
  );
}

function DashboardCharts({ expenses, documents, totalStorageBytes, loading }) {
  const { theme } = useTheme();
  const chartColors = useMemo(() => {
    if (!theme) return [];
    const styles = window.getComputedStyle(document.documentElement);
    return Array.from({ length: 5 }, (_, index) => (
      styles.getPropertyValue(`--chart-color-${index + 1}`).trim()
    ));
  }, [theme]);
  const today = new Date();
  const weeklyData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = dateKey(date);
    return {
      key,
      label: new Intl.DateTimeFormat("en-US", { weekday: "narrow" }).format(date),
      fullLabel: new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(date),
      value: expenseTotal(expenses, key),
    };
  });
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthlyData = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), index + 1);
    const key = dateKey(date);
    return {
      key,
      label: index === 0 || (index + 1) % 5 === 0 ? String(index + 1) : "",
      fullLabel: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(date),
      value: expenseTotal(expenses, key),
    };
  });
  const weeklyTotal = weeklyData.reduce((total, day) => total + day.value, 0);
  const monthlyTotal = monthlyData.reduce((total, day) => total + day.value, 0);

  return (
    <section className="dashboard-chart-grid" aria-label="CandyVault charts">
      <DashboardWidget title="Weekly Expenses" kicker={fullCurrency.format(weeklyTotal)} tone="pink" className="chart-widget">
        {loading ? <div className="chart-loading"><span />Counting this week’s treats…</div> : <BarChart data={weeklyData} emptyMessage="No expenses during the last seven days." />}
      </DashboardWidget>

      <DashboardWidget title="Monthly Expenses" kicker={fullCurrency.format(monthlyTotal)} tone="blue" className="chart-widget chart-widget-wide">
        {loading ? <div className="chart-loading"><span />Building this month’s candy graph…</div> : <BarChart data={monthlyData} emptyMessage="No expenses recorded this month." />}
      </DashboardWidget>

      <DashboardWidget title="Storage Used" kicker={`${documents.length} files`} tone="mint" className="chart-widget">
        {loading ? <div className="chart-loading"><span />Weighing the document jar…</div> : <StorageChart documents={documents} totalStorageBytes={totalStorageBytes} colors={chartColors} />}
      </DashboardWidget>
    </section>
  );
}

export default DashboardCharts;
