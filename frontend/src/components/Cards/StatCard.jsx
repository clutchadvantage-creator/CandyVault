function StatCard({ label, value, detail, icon, statusTone }) {
  const valueClassName = statusTone ? "stat-value status-value" : "stat-value";

  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span className="card-icon" aria-hidden="true">{icon}</span>
      </div>
      <div className={valueClassName} aria-live={statusTone ? "polite" : undefined}>
        {statusTone && <span className={`status-dot ${statusTone}`} aria-hidden="true" />}
        {value}
      </div>
      <div className="stat-detail">{detail}</div>
    </article>
  );
}

export default StatCard;
