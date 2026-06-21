from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


PayType = Literal["hourly", "salary", "fixed"]
PayFrequency = Literal["weekly", "biweekly", "semimonthly", "monthly", "yearly"]


class PayProfileBase(BaseModel):
    profile_name: str = Field(min_length=1, max_length=120)
    employer_name: str | None = Field(default=None, max_length=180)
    job_title: str | None = Field(default=None, max_length=180)
    pay_type: PayType
    pay_amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    pay_frequency: PayFrequency
    hours_per_week: Decimal | None = Field(default=None, ge=0, max_digits=6, decimal_places=2)
    pay_day_notes: str | None = Field(default=None, max_length=500)
    overtime_enabled: bool = False
    overtime_rate_multiplier: Decimal = Field(
        default=Decimal("1.5"), ge=1, max_digits=5, decimal_places=2
    )
    overtime_hours_per_week: Decimal = Field(
        default=Decimal("0"), ge=0, max_digits=6, decimal_places=2
    )
    overtime_notes: str | None = Field(default=None, max_length=10000)
    federal_tax_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    state_tax_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    local_tax_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    other_deductions_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    other_deductions_amount: Decimal = Field(
        default=Decimal("0"), ge=0, max_digits=12, decimal_places=2
    )
    active: bool = True
    notes: str | None = Field(default=None, max_length=10000)

    @field_validator("profile_name")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("employer_name", "job_title", "pay_day_notes", "overtime_notes", "notes")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @model_validator(mode="after")
    def validate_hourly_hours(self):
        if self.pay_type == "hourly" and self.hours_per_week is None:
            raise ValueError("hours_per_week is required for hourly pay")
        if self.pay_type != "hourly" and self.overtime_enabled:
            raise ValueError("overtime is currently supported only for hourly pay profiles")
        combined_percent = (
            self.federal_tax_percent
            + self.state_tax_percent
            + self.local_tax_percent
            + self.other_deductions_percent
        )
        if combined_percent > Decimal("100"):
            raise ValueError("combined tax and deduction percentage must not exceed 100")
        return self


class PayProfileCreate(PayProfileBase):
    pass


class PayProfileUpdate(PayProfileBase):
    pass


class PayProfileRead(PayProfileBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    regular_weekly_gross: Decimal
    overtime_weekly_gross: Decimal
    total_tax_percent: Decimal
    estimated_weekly_gross_income: Decimal
    estimated_monthly_gross_income: Decimal
    estimated_yearly_gross_income: Decimal
    estimated_weekly_taxes: Decimal
    estimated_monthly_taxes: Decimal
    estimated_yearly_taxes: Decimal
    estimated_weekly_net_income: Decimal
    estimated_monthly_net_income: Decimal
    estimated_yearly_net_income: Decimal
    created_at: datetime
    updated_at: datetime


class PayProfileSummary(BaseModel):
    total_active_profiles: int
    estimated_weekly_gross_income: Decimal
    estimated_monthly_gross_income: Decimal
    estimated_yearly_gross_income: Decimal
    estimated_weekly_net_income: Decimal
    estimated_monthly_net_income: Decimal
    estimated_yearly_net_income: Decimal
    estimated_monthly_taxes: Decimal
    estimated_yearly_taxes: Decimal
