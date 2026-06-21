function FilterBar({ children, onClear, activeCount = 0 }) {
  return (
    <section className="filter-bar" aria-label="Search and filters">
      <div className="filter-bar-heading">
        <div>
          <span className="filter-bar-kicker">Candy counter</span>
          <h2>Search &amp; Filters</h2>
        </div>
        <div className="filter-bar-status">
          <span>{activeCount} active</span>
          <button type="button" onClick={onClear} disabled={activeCount === 0}>Clear filters</button>
        </div>
      </div>
      <div className="filter-controls">{children}</div>
    </section>
  );
}

export default FilterBar;
