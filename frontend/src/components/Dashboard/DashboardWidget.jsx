function DashboardWidget({ title, kicker, tone = "pink", className = "", children }) {
  return (
    <section className={`dashboard-widget widget-${tone} ${className}`.trim()}>
      <div className="widget-header">
        <h2>{title}</h2>
        {kicker && <span>{kicker}</span>}
      </div>
      <div className="widget-body">{children}</div>
    </section>
  );
}

export default DashboardWidget;
