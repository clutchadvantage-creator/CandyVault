const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function CategoryBreakdown({ summary, title = "Current Month by Category", compact = false }) {
  const categories = summary?.categories || [];

  if (compact) {
    return categories.length === 0 ? (
      <div className="widget-state">No spending recorded this month.</div>
    ) : (
      <div className="top-category-list">
        {categories.slice(0, 3).map((item, index) => (
          <div className="top-category-item" key={item.category}>
            <span className="top-category-rank">{index + 1}</span>
            <div>
              <strong>{item.category}</strong>
              <small>{item.expense_count} {item.expense_count === 1 ? "expense" : "expenses"} · {Number(item.percentage_of_total).toFixed(1)}%</small>
            </div>
            <b>{currencyFormatter.format(Number(item.total_amount) || 0)}</b>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="category-breakdown" aria-labelledby="category-breakdown-title">
      <div className="category-breakdown-heading">
        <div>
          <span className="panel-kicker">Spending mix</span>
          <h2 id="category-breakdown-title">{title}</h2>
        </div>
        <strong>{currencyFormatter.format(Number(summary?.total_expenses) || 0)} total</strong>
      </div>
      {categories.length === 0 ? (
        <p className="category-breakdown-empty">No spending activity for this period.</p>
      ) : (
        <div className="category-card-grid">
          {categories.map((item) => (
            <article className="category-summary-card" key={item.category}>
              <div className="category-card-topline">
                <h3>{item.category}</h3>
                <span>{Number(item.percentage_of_total).toFixed(1)}%</span>
              </div>
              <strong>{currencyFormatter.format(Number(item.total_amount) || 0)}</strong>
              <small>{item.expense_count} {item.expense_count === 1 ? "expense" : "expenses"}</small>
              <div className="category-progress" aria-label={`${item.category}: ${Number(item.percentage_of_total).toFixed(1)} percent of spending`}>
                <span style={{ width: `${Math.min(100, Math.max(0, Number(item.percentage_of_total) || 0))}%` }} />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default CategoryBreakdown;
