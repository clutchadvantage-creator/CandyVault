from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ExpenseCreate(BaseModel):
    description: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=100)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    expense_date: date
    is_recurring: bool = False
    recurrence_frequency: Literal["weekly", "biweekly", "monthly", "quarterly", "yearly"] | None = None
    recurrence_notes: str | None = Field(default=None, max_length=500)

    @field_validator("description", "category")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("recurrence_notes")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @model_validator(mode="after")
    def validate_recurrence(self):
        if self.is_recurring and self.recurrence_frequency is None:
            raise ValueError("recurrence_frequency is required for recurring expenses")
        if not self.is_recurring and self.recurrence_frequency is not None:
            raise ValueError("recurrence_frequency requires is_recurring to be true")
        return self


class ExpenseRead(ExpenseCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class ExpenseUpdate(ExpenseCreate):
    pass


class ExpenseSummary(BaseModel):
    total_expenses: Decimal
    expense_count: int
    monthly_total: Decimal
    recurring_expense_count: int
    estimated_monthly_recurring_total: Decimal
