from datetime import date, timedelta
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Expense
from app.schemas import (
    ExpenseCategorySummary,
    ExpenseCategoryTotal,
    ExpenseCreate,
    ExpenseRead,
    ExpenseSummary,
    ExpenseUpdate,
)


router = APIRouter(prefix="/expenses", tags=["expenses"])

RECURRING_MONTHLY_MULTIPLIERS = {
    "weekly": Decimal("52") / Decimal("12"),
    "biweekly": Decimal("26") / Decimal("12"),
    "monthly": Decimal("1"),
    "quarterly": Decimal("4") / Decimal("12"),
    "yearly": Decimal("1") / Decimal("12"),
}

STANDARD_CATEGORIES = (
    "Housing",
    "Food",
    "Transportation",
    "Utilities",
    "Debt",
    "Insurance",
    "Medical",
    "Entertainment",
    "Household",
    "Personal",
    "Savings",
    "Other",
)


def next_calendar_month(month_start: date) -> date:
    return (
        month_start.replace(year=month_start.year + 1, month=1)
        if month_start.month == 12
        else month_start.replace(month=month_start.month + 1)
    )

def get_expense_or_404(expense_id: int, db: Session) -> Expense:
    expense = db.get(Expense, expense_id)
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found.")
    return expense


@router.get("", response_model=list[ExpenseRead])
def list_expenses(
    search: Annotated[str | None, Query(max_length=255)] = None,
    category: Annotated[str | None, Query(max_length=100)] = None,
    start_date: date | None = None,
    end_date: date | None = None,
    is_recurring: bool | None = None,
    history_days: Annotated[int | None, Query(ge=1, le=3650)] = None,
    sort_by: Literal["expense_date", "amount", "category", "created_at"] = "expense_date",
    sort_dir: Literal["asc", "desc"] = "desc",
    db: Session = Depends(get_db),
) -> list[Expense]:
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must be on or before end_date.")

    statement = select(Expense)
    if search and (search_term := search.strip()):
        pattern = f"%{search_term}%"
        statement = statement.where(
            or_(Expense.description.ilike(pattern), Expense.category.ilike(pattern))
        )
    if category and (category_value := category.strip()):
        statement = statement.where(func.lower(Expense.category) == category_value.lower())
    if start_date:
        statement = statement.where(Expense.expense_date >= start_date)
    if end_date:
        statement = statement.where(Expense.expense_date <= end_date)
    if is_recurring is not None:
        statement = statement.where(Expense.is_recurring.is_(is_recurring))
    if history_days is not None:
        cutoff_date = date.today() - timedelta(days=history_days)
        statement = statement.where(
            or_(Expense.is_recurring.is_(True), Expense.expense_date >= cutoff_date)
        )

    sort_columns = {
        "expense_date": Expense.expense_date,
        "amount": Expense.amount,
        "category": Expense.category,
        "created_at": Expense.created_at,
    }
    sort_column = sort_columns[sort_by]
    order = sort_column.asc() if sort_dir == "asc" else sort_column.desc()
    id_order = Expense.id.asc() if sort_dir == "asc" else Expense.id.desc()
    statement = statement.order_by(order, id_order)
    return list(db.scalars(statement).all())


@router.post("", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
def create_expense(expense_data: ExpenseCreate, db: Session = Depends(get_db)) -> Expense:
    expense = Expense(**expense_data.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.get("/summary", response_model=ExpenseSummary)
def get_expense_summary(db: Session = Depends(get_db)) -> ExpenseSummary:
    today = date.today()
    month_start = today.replace(day=1)
    next_month = (
        month_start.replace(year=month_start.year + 1, month=1)
        if month_start.month == 12
        else month_start.replace(month=month_start.month + 1)
    )

    total, count = db.execute(
        select(
            func.coalesce(func.sum(Expense.amount), 0),
            func.count(Expense.id),
        )
    ).one()
    monthly_total = db.scalar(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.expense_date >= month_start,
            Expense.expense_date < next_month,
        )
    )
    recurring_expenses = list(
        db.scalars(select(Expense).where(Expense.is_recurring.is_(True))).all()
    )
    estimated_monthly_recurring_total = sum(
        (
            expense.amount
            * RECURRING_MONTHLY_MULTIPLIERS[expense.recurrence_frequency]
            for expense in recurring_expenses
            if expense.recurrence_frequency in RECURRING_MONTHLY_MULTIPLIERS
        ),
        Decimal("0"),
    )

    return ExpenseSummary(
        total_expenses=Decimal(total),
        expense_count=count,
        monthly_total=Decimal(monthly_total or 0),
        recurring_expense_count=len(recurring_expenses),
        estimated_monthly_recurring_total=estimated_monthly_recurring_total,
    )


@router.get("/category-summary", response_model=ExpenseCategorySummary)
def get_expense_category_summary(
    month: Annotated[int | None, Query(ge=1, le=12)] = None,
    year: Annotated[int | None, Query(ge=1, le=9999)] = None,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
) -> ExpenseCategorySummary:
    has_month_period = month is not None or year is not None
    has_custom_period = start_date is not None or end_date is not None

    if has_month_period and has_custom_period:
        raise HTTPException(
            status_code=422,
            detail="Use either month/year or start_date/end_date, not both.",
        )
    if has_month_period and (month is None or year is None):
        raise HTTPException(status_code=422, detail="month and year must be provided together.")
    if has_custom_period and (start_date is None or end_date is None):
        raise HTTPException(
            status_code=422,
            detail="start_date and end_date must be provided together.",
        )
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must be on or before end_date.")

    response_month: int | None = None
    response_year: int | None = None
    if start_date is not None and end_date is not None:
        period_start = start_date
        period_end_exclusive = end_date + timedelta(days=1)
    else:
        today = date.today()
        response_month = month if month is not None else today.month
        response_year = year if year is not None else today.year
        period_start = date(response_year, response_month, 1)
        period_end_exclusive = next_calendar_month(period_start)

    trimmed_category = func.trim(Expense.category)
    lowered_category = func.lower(trimmed_category)
    normalized_category = case(
        (or_(Expense.category.is_(None), trimmed_category == ""), "Other"),
        *(
            (lowered_category == label.lower(), label)
            for label in STANDARD_CATEGORIES
        ),
        else_=trimmed_category,
    ).label("category")

    rows = db.execute(
        select(
            normalized_category,
            func.coalesce(func.sum(Expense.amount), 0).label("total_amount"),
            func.count(Expense.id).label("expense_count"),
        )
        .where(
            Expense.expense_date >= period_start,
            Expense.expense_date < period_end_exclusive,
        )
        .group_by(normalized_category)
        .order_by(func.sum(Expense.amount).desc(), normalized_category.asc())
    ).all()

    total_expenses = sum((Decimal(row.total_amount) for row in rows), Decimal("0"))
    category_totals = [
        ExpenseCategoryTotal(
            category=row.category,
            total_amount=Decimal(row.total_amount),
            expense_count=row.expense_count,
            percentage_of_total=(
                (Decimal(row.total_amount) / total_expenses * Decimal("100")).quantize(
                    Decimal("0.01")
                )
                if total_expenses
                else Decimal("0.00")
            ),
        )
        for row in rows
    ]

    return ExpenseCategorySummary(
        month=response_month,
        year=response_year,
        total_expenses=total_expenses,
        categories=category_totals,
    )


@router.put("/{expense_id}", response_model=ExpenseRead)
def update_expense(
    expense_id: int,
    expense_data: ExpenseUpdate,
    db: Session = Depends(get_db),
) -> Expense:
    expense = get_expense_or_404(expense_id, db)
    for field, value in expense_data.model_dump().items():
        setattr(expense, field, value)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    expense = get_expense_or_404(expense_id, db)
    db.delete(expense)
    db.commit()
    # TODO: Add an intentional archive/relink workflow for notes orphaned by deletion.
    return {"message": "Expense deleted successfully."}
