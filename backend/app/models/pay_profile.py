from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


FREQUENCY_MULTIPLIERS = {
    "weekly": Decimal("52"),
    "biweekly": Decimal("26"),
    "semimonthly": Decimal("24"),
    "monthly": Decimal("12"),
    "yearly": Decimal("1"),
}


class PayProfile(Base):
    __tablename__ = "pay_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    profile_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    employer_name: Mapped[str | None] = mapped_column(String(180))
    job_title: Mapped[str | None] = mapped_column(String(180))
    pay_type: Mapped[str] = mapped_column(String(20), nullable=False)
    pay_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    pay_frequency: Mapped[str] = mapped_column(String(20), nullable=False)
    hours_per_week: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    pay_day_notes: Mapped[str | None] = mapped_column(String(500))
    overtime_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    overtime_rate_multiplier: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("1.5")
    )
    overtime_hours_per_week: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False, default=Decimal("0")
    )
    overtime_notes: Mapped[str | None] = mapped_column(Text)
    federal_tax_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0")
    )
    state_tax_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0")
    )
    local_tax_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0")
    )
    other_deductions_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0")
    )
    other_deductions_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0")
    )
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    @property
    def regular_weekly_gross(self) -> Decimal:
        if self.pay_type == "hourly":
            return self.pay_amount * (self.hours_per_week or Decimal("0"))
        return self.estimated_yearly_gross_income / Decimal("52")

    @property
    def overtime_weekly_gross(self) -> Decimal:
        if self.pay_type != "hourly" or not self.overtime_enabled:
            return Decimal("0")
        return (
            self.pay_amount
            * self.overtime_rate_multiplier
            * self.overtime_hours_per_week
        )

    @property
    def total_tax_percent(self) -> Decimal:
        return (
            self.federal_tax_percent
            + self.state_tax_percent
            + self.local_tax_percent
            + self.other_deductions_percent
        )

    @property
    def estimated_yearly_gross_income(self) -> Decimal:
        if self.pay_type == "hourly":
            return (self.regular_weekly_gross + self.overtime_weekly_gross) * Decimal("52")
        return self.pay_amount * FREQUENCY_MULTIPLIERS[self.pay_frequency]

    @property
    def estimated_weekly_gross_income(self) -> Decimal:
        return self.estimated_yearly_gross_income / Decimal("52")

    @property
    def estimated_monthly_gross_income(self) -> Decimal:
        return self.estimated_yearly_gross_income / Decimal("12")

    def tax_for_period(self, gross: Decimal, fixed_deduction: Decimal) -> Decimal:
        return gross * self.total_tax_percent / Decimal("100") + fixed_deduction

    @property
    def estimated_weekly_taxes(self) -> Decimal:
        return self.tax_for_period(
            self.estimated_weekly_gross_income,
            self.other_deductions_amount / Decimal("52"),
        )

    @property
    def estimated_monthly_taxes(self) -> Decimal:
        return self.tax_for_period(
            self.estimated_monthly_gross_income,
            self.other_deductions_amount / Decimal("12"),
        )

    @property
    def estimated_yearly_taxes(self) -> Decimal:
        return self.tax_for_period(
            self.estimated_yearly_gross_income,
            self.other_deductions_amount,
        )

    @property
    def estimated_weekly_net_income(self) -> Decimal:
        return self.estimated_weekly_gross_income - self.estimated_weekly_taxes

    @property
    def estimated_monthly_net_income(self) -> Decimal:
        return self.estimated_monthly_gross_income - self.estimated_monthly_taxes

    @property
    def estimated_yearly_net_income(self) -> Decimal:
        return self.estimated_yearly_gross_income - self.estimated_yearly_taxes
