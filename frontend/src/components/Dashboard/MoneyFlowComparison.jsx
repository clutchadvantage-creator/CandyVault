import { Link } from "react-router-dom";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function MoneyFlowComparison({ grossIncome, netIncome, taxes, expenses, loading }) {
  const gross = Number(grossIncome) || 0;
  const net = Number(netIncome) || 0;
  const deductions = Number(taxes) || 0;
  const moneyOut = Number(expenses) || 0;
  const remaining = net - moneyOut;
  const scale = Math.max(gross, deductions, moneyOut, Math.abs(remaining), 1);
  const percent = (value) => `${Math.max((Math.abs(value) / scale) * 100, value ? 3 : 0)}%`;

  return (
    <section className="money-flow-card" aria-label="Money in versus money out">
      <div className="money-flow-heading">
        <div><span>Household cash flow</span><h2>Money In vs Money Out</h2></div>
        <Link to="/pay-profiles">Manage Pay Candy →</Link>
      </div>
      {loading ? (
        <div className="money-flow-loading" role="status"><span />Balancing the candy jar…</div>
      ) : (
        <div className="money-flow-bars">
          <div className="money-flow-row gross-income-row"><div><span aria-hidden="true">🍬</span><strong>Gross Income</strong><b>{currencyFormatter.format(gross)}</b></div><div className="money-flow-track"><i style={{ width: percent(gross) }} /></div></div>
          <div className="money-flow-row tax-row"><div><span aria-hidden="true">🧮</span><strong>Taxes / Deductions</strong><b>{currencyFormatter.format(deductions)}</b></div><div className="money-flow-track"><i style={{ width: percent(deductions) }} /></div></div>
          <div className="money-flow-row money-out-row"><div><span aria-hidden="true">🧾</span><strong>Money Out</strong><b>{currencyFormatter.format(moneyOut)}</b></div><div className="money-flow-track"><i style={{ width: percent(moneyOut) }} /></div></div>
          <div className={`money-flow-row remaining-row${remaining < 0 ? " negative" : ""}`}><div><span aria-hidden="true">🍭</span><strong>{remaining < 0 ? "Over Budget" : "Candy Left in the Jar"}</strong><b>{currencyFormatter.format(remaining)}</b></div><div className="money-flow-track"><i style={{ width: percent(remaining) }} /></div></div>
        </div>
      )}
    </section>
  );
}

export default MoneyFlowComparison;
