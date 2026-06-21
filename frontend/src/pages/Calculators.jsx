import { useState } from "react";
import PageIntro from "../components/Header/PageIntro.jsx";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const percent = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const openedAt = new Date();

function numberFrom(value) {
  if (value === "") return { number: 0, valid: true };
  const number = Number(value);
  return { number: Number.isFinite(number) ? number : 0, valid: Number.isFinite(number) && number >= 0 };
}

function NumberField({ label, name, value, onChange, prefix = "$", step = "0.01", hint }) {
  return (
    <label className="calculator-field">
      <span>{label}</span>
      <div className="calculator-input-wrap">
        {prefix && <b aria-hidden="true">{prefix}</b>}
        <input name={name} type="number" min="0" step={step} value={value} onChange={onChange} placeholder="0" />
      </div>
      {hint && <small>{hint}</small>}
    </label>
  );
}

function ResultCard({ changeKey, title, warning, children }) {
  return (
    <section key={changeKey} className={`calculator-result${warning ? " result-warning" : ""}`} aria-live="polite">
      <div className="result-card-label">Fresh result</div>
      <h3>{title}</h3>
      {warning && <div className="calculator-warning">{warning}</div>}
      <div className="result-values">{children}</div>
    </section>
  );
}

function WorkPanel({ children }) {
  return <section className="show-work"><div className="show-work-heading"><span aria-hidden="true">=</span><h3>Show My Work</h3></div>{children}</section>;
}

function MonthlyBudgetCalculator() {
  const [values, setValues] = useState({ income: "", bills: "", food: "", fuel: "", debt: "", savings: "", other: "" });
  function update(event) { setValues((current) => ({ ...current, [event.target.name]: event.target.value })); }
  const parsed = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, numberFrom(value)]));
  const invalid = Object.values(parsed).some((item) => !item.valid);
  const total = parsed.bills.number + parsed.food.number + parsed.fuel.number + parsed.debt.number + parsed.savings.number + parsed.other.number;
  const leftover = parsed.income.number - total;
  const savingsRate = parsed.income.number > 0 ? (parsed.savings.number / parsed.income.number) * 100 : 0;

  return (
    <CalculatorLayout title="Monthly Budget" subtitle="See where every candy coin goes each month.">
      <div className="calculator-fields calculator-fields-wide">
        <NumberField label="Monthly income" name="income" value={values.income} onChange={update} />
        <NumberField label="Fixed bills" name="bills" value={values.bills} onChange={update} />
        <NumberField label="Food" name="food" value={values.food} onChange={update} />
        <NumberField label="Fuel" name="fuel" value={values.fuel} onChange={update} />
        <NumberField label="Debt payments" name="debt" value={values.debt} onChange={update} />
        <NumberField label="Savings goal" name="savings" value={values.savings} onChange={update} />
        <NumberField label="Other expenses" name="other" value={values.other} onChange={update} />
      </div>
      <ResultCard changeKey={Object.values(values).join("|")} title="Monthly candy jar balance" warning={invalid ? "Use zero or positive numbers only." : leftover < 0 ? "Expenses exceed income. This budget needs a little rewrapping." : ""}>
        <ResultValue label="Total expenses" value={currency.format(total)} />
        <ResultValue label="Leftover money" value={currency.format(leftover)} accent={leftover >= 0} />
        <ResultValue label="Savings percentage" value={`${percent.format(savingsRate)}%`} />
      </ResultCard>
      <WorkPanel>
        <p><strong>Step 1:</strong> Add bills, food, fuel, debt, savings, and other expenses.</p>
        <code>{currency.format(parsed.bills.number)} + {currency.format(parsed.food.number)} + {currency.format(parsed.fuel.number)} + {currency.format(parsed.debt.number)} + {currency.format(parsed.savings.number)} + {currency.format(parsed.other.number)} = {currency.format(total)}</code>
        <p><strong>Step 2:</strong> Income − total expenses = leftover.</p>
        <code>{currency.format(parsed.income.number)} − {currency.format(total)} = {currency.format(leftover)}</code>
      </WorkPanel>
    </CalculatorLayout>
  );
}

function LoanCalculator() {
  const [values, setValues] = useState({ amount: "", rate: "", months: "" });
  function update(event) { setValues((current) => ({ ...current, [event.target.name]: event.target.value })); }
  const amount = numberFrom(values.amount);
  const rate = numberFrom(values.rate);
  const months = numberFrom(values.months);
  const ready = amount.number > 0 && months.number > 0 && amount.valid && rate.valid && months.valid;
  const monthlyRate = rate.number / 100 / 12;
  const payment = ready
    ? monthlyRate === 0
      ? amount.number / months.number
      : amount.number * (monthlyRate * (1 + monthlyRate) ** months.number) / ((1 + monthlyRate) ** months.number - 1)
    : 0;
  const totalPaid = payment * months.number;
  const interest = Math.max(totalPaid - amount.number, 0);
  const hasInput = Object.values(values).some(Boolean);
  const warning = hasInput && !ready ? "Enter a loan amount and term above zero, with a valid non-negative rate." : "";

  return (
    <CalculatorLayout title="Loan Payment" subtitle="Estimate the monthly bite and total cost of a loan.">
      <div className="calculator-fields">
        <NumberField label="Loan amount" name="amount" value={values.amount} onChange={update} />
        <NumberField label="Annual interest rate" name="rate" value={values.rate} onChange={update} prefix="%" hint="Example: 6.5" />
        <NumberField label="Term in months" name="months" value={values.months} onChange={update} prefix="" step="1" />
      </div>
      <ResultCard changeKey={Object.values(values).join("|")} title="Estimated loan cost" warning={warning}>
        <ResultValue label="Monthly payment" value={currency.format(payment)} accent />
        <ResultValue label="Total paid" value={currency.format(totalPaid)} />
        <ResultValue label="Total interest" value={currency.format(interest)} />
      </ResultCard>
      <WorkPanel>
        <p><strong>Monthly interest rate:</strong> annual rate ÷ 12 ÷ 100.</p>
        <code>{percent.format(rate.number)}% ÷ 12 ÷ 100 = {monthlyRate.toFixed(6)}</code>
        <p><strong>Payment formula:</strong> principal × [r(1+r)ⁿ] ÷ [(1+r)ⁿ−1]. A zero-interest loan uses principal ÷ months.</p>
        <code>Estimated payment = {currency.format(payment)} per month</code>
      </WorkPanel>
    </CalculatorLayout>
  );
}

function SavingsCalculator() {
  const [values, setValues] = useState({ goal: "", current: "", contribution: "" });
  function update(event) { setValues((currentValues) => ({ ...currentValues, [event.target.name]: event.target.value })); }
  const goal = numberFrom(values.goal);
  const current = numberFrom(values.current);
  const contribution = numberFrom(values.contribution);
  const invalid = !goal.valid || !current.valid || !contribution.valid;
  const remaining = Math.max(goal.number - current.number, 0);
  const reached = goal.number > 0 && current.number >= goal.number;
  const months = reached ? 0 : contribution.number > 0 ? Math.ceil(remaining / contribution.number) : null;
  const completion = months === null ? null : new Date(openedAt.getFullYear(), openedAt.getMonth() + months, 1);
  const progress = goal.number > 0 ? Math.min((current.number / goal.number) * 100, 100) : 0;

  return (
    <CalculatorLayout title="Savings Goal" subtitle="Chart a candy-striped path toward your next goal.">
      <div className="calculator-fields">
        <NumberField label="Goal amount" name="goal" value={values.goal} onChange={update} />
        <NumberField label="Current savings" name="current" value={values.current} onChange={update} />
        <NumberField label="Monthly contribution" name="contribution" value={values.contribution} onChange={update} />
      </div>
      <div className={`savings-progress${reached ? " goal-reached" : ""}`}>
        <div className="savings-progress-label"><span>Jar progress</span><strong>{percent.format(progress)}%</strong></div>
        <div className="candy-progress-track"><span style={{ width: `${progress}%` }} /></div>
        {reached && <div className="goal-sparkles" aria-hidden="true"><i>✦</i><i>●</i><i>✦</i><i>●</i></div>}
      </div>
      <ResultCard changeKey={Object.values(values).join("|")} title={reached ? "Goal reached — sweet!" : "Savings timeline"} warning={invalid ? "Use zero or positive numbers only." : remaining > 0 && contribution.number === 0 ? "Add a monthly contribution to estimate a completion date." : ""}>
        <ResultValue label="Amount remaining" value={currency.format(remaining)} />
        <ResultValue label="Months to goal" value={months === null ? "—" : String(months)} accent={reached} />
        <ResultValue label="Estimated completion" value={completion ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(completion) : "—"} />
      </ResultCard>
      <WorkPanel>
        <p><strong>Step 1:</strong> Goal − current savings = remaining.</p>
        <code>{currency.format(goal.number)} − {currency.format(current.number)} = {currency.format(remaining)}</code>
        <p><strong>Step 2:</strong> Remaining ÷ monthly contribution = months.</p>
        <code>{currency.format(remaining)} ÷ {currency.format(contribution.number)} = {months === null ? "waiting for a contribution" : `${months} months (rounded up)`}</code>
      </WorkPanel>
    </CalculatorLayout>
  );
}

function HourlyCalculator() {
  const [values, setValues] = useState({ wage: "", hours: "40", weeks: "52" });
  function update(event) { setValues((current) => ({ ...current, [event.target.name]: event.target.value })); }
  const wage = numberFrom(values.wage);
  const hours = numberFrom(values.hours);
  const weeks = numberFrom(values.weeks);
  const invalid = !wage.valid || !hours.valid || !weeks.valid;
  const weekly = wage.number * hours.number;
  const annual = weekly * weeks.number;
  const monthly = annual / 12;

  return (
    <CalculatorLayout title="Hourly to Annual" subtitle="Turn an hourly wage into weekly, monthly, and annual estimates.">
      <div className="calculator-fields">
        <NumberField label="Hourly wage" name="wage" value={values.wage} onChange={update} />
        <NumberField label="Hours per week" name="hours" value={values.hours} onChange={update} prefix="" step="0.5" />
        <NumberField label="Weeks per year" name="weeks" value={values.weeks} onChange={update} prefix="" step="1" />
      </div>
      <ResultCard changeKey={Object.values(values).join("|")} title="Gross income estimate" warning={invalid ? "Use zero or positive numbers only." : ""}>
        <ResultValue label="Weekly gross" value={currency.format(weekly)} />
        <ResultValue label="Monthly gross" value={currency.format(monthly)} />
        <ResultValue label="Annual gross" value={currency.format(annual)} accent />
      </ResultCard>
      <WorkPanel>
        <p><strong>Annual:</strong> hourly wage × weekly hours × working weeks.</p>
        <code>{currency.format(wage.number)} × {hours.number || 0} × {weeks.number || 0} = {currency.format(annual)}</code>
        <p><strong>Monthly estimate:</strong> annual gross ÷ 12.</p>
        <code>{currency.format(annual)} ÷ 12 = {currency.format(monthly)}</code>
      </WorkPanel>
    </CalculatorLayout>
  );
}

function PercentageCalculator() {
  const [values, setValues] = useState({ original: "", next: "" });
  function update(event) { setValues((current) => ({ ...current, [event.target.name]: event.target.value })); }
  const original = numberFrom(values.original);
  const next = numberFrom(values.next);
  const invalid = !original.valid || !next.valid;
  const difference = next.number - original.number;
  const change = original.number !== 0 ? (difference / original.number) * 100 : null;
  const label = difference > 0 ? "Increase" : difference < 0 ? "Decrease" : "No change";

  return (
    <CalculatorLayout title="Percentage Change" subtitle="Measure how much a value grew, shrank, or stayed put.">
      <div className="calculator-fields calculator-fields-two">
        <NumberField label="Original value" name="original" value={values.original} onChange={update} prefix="" />
        <NumberField label="New value" name="next" value={values.next} onChange={update} prefix="" />
      </div>
      <ResultCard changeKey={Object.values(values).join("|")} title={label} warning={invalid ? "Use zero or positive numbers only." : values.original !== "" && original.number === 0 ? "Percentage change is undefined when the original value is zero." : ""}>
        <ResultValue label="Difference" value={percent.format(difference)} />
        <ResultValue label="Percentage change" value={change === null ? "—" : `${percent.format(change)}%`} accent={change !== null && change >= 0} />
        <ResultValue label="Direction" value={label} />
      </ResultCard>
      <WorkPanel>
        <p><strong>Formula:</strong> (new − original) ÷ original × 100.</p>
        <code>({percent.format(next.number)} − {percent.format(original.number)}) ÷ {percent.format(original.number)} × 100 = {change === null ? "undefined" : `${percent.format(change)}%`}</code>
      </WorkPanel>
    </CalculatorLayout>
  );
}

function CalculatorLayout({ title, subtitle, children }) {
  return <div className="calculator-workspace"><div className="calculator-workspace-heading"><span>Now calculating</span><h2>{title}</h2><p>{subtitle}</p></div>{children}</div>;
}

function ResultValue({ label, value, accent = false }) {
  return <div className={accent ? "result-value result-accent" : "result-value"}><span>{label}</span><strong>{value}</strong></div>;
}

const calculatorTabs = [
  { id: "budget", label: "Monthly Budget", short: "Budget" },
  { id: "loan", label: "Loan Payment", short: "Loan" },
  { id: "savings", label: "Savings Goal", short: "Savings" },
  { id: "hourly", label: "Hourly to Annual", short: "Income" },
  { id: "percentage", label: "Percentage Change", short: "% Change" },
];

function Calculators() {
  const [active, setActive] = useState("budget");
  const calculators = {
    budget: <MonthlyBudgetCalculator />,
    loan: <LoanCalculator />,
    savings: <SavingsCalculator />,
    hourly: <HourlyCalculator />,
    percentage: <PercentageCalculator />,
  };

  return (
    <>
      <PageIntro eyebrow="Candy math counter" title="Calculators" description="Friendly financial tools that show every step while you crunch the numbers." />
      <nav className="calculator-tabs" aria-label="Calculator selection">
        {calculatorTabs.map((tab) => (
          <button key={tab.id} type="button" className={active === tab.id ? "active" : ""} onClick={() => setActive(tab.id)} aria-pressed={active === tab.id}>
            <span>{tab.short}</span><strong>{tab.label}</strong>
          </button>
        ))}
      </nav>
      {calculators[active]}
      <p className="calculator-disclaimer">Estimates are for planning only and do not include taxes, fees, or financial advice.</p>
    </>
  );
}

export default Calculators;
