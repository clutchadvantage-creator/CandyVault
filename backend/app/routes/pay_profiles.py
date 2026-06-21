from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PayProfile
from app.schemas import (
    PayProfileCreate,
    PayProfileRead,
    PayProfileSummary,
    PayProfileUpdate,
)


router = APIRouter(prefix="/pay-profiles", tags=["pay profiles"])


def get_profile_or_404(profile_id: int, db: Session) -> PayProfile:
    profile = db.get(PayProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Pay profile not found.")
    return profile


@router.get("", response_model=list[PayProfileRead])
def list_pay_profiles(db: Session = Depends(get_db)) -> list[PayProfile]:
    return list(db.scalars(select(PayProfile).order_by(PayProfile.profile_name, PayProfile.id)).all())


@router.get("/summary", response_model=PayProfileSummary)
def get_pay_profile_summary(db: Session = Depends(get_db)) -> PayProfileSummary:
    profiles = list(db.scalars(select(PayProfile).where(PayProfile.active.is_(True))).all())
    yearly_gross = sum(
        (profile.estimated_yearly_gross_income for profile in profiles), Decimal("0")
    )
    yearly_taxes = sum(
        (profile.estimated_yearly_taxes for profile in profiles), Decimal("0")
    )
    yearly_net = yearly_gross - yearly_taxes
    return PayProfileSummary(
        total_active_profiles=len(profiles),
        estimated_weekly_gross_income=yearly_gross / Decimal("52"),
        estimated_monthly_gross_income=yearly_gross / Decimal("12"),
        estimated_yearly_gross_income=yearly_gross,
        estimated_weekly_net_income=yearly_net / Decimal("52"),
        estimated_monthly_net_income=yearly_net / Decimal("12"),
        estimated_yearly_net_income=yearly_net,
        estimated_monthly_taxes=yearly_taxes / Decimal("12"),
        estimated_yearly_taxes=yearly_taxes,
    )


@router.get("/{profile_id}", response_model=PayProfileRead)
def get_pay_profile(profile_id: int, db: Session = Depends(get_db)) -> PayProfile:
    return get_profile_or_404(profile_id, db)


@router.post("", response_model=PayProfileRead, status_code=status.HTTP_201_CREATED)
def create_pay_profile(
    profile_data: PayProfileCreate,
    db: Session = Depends(get_db),
) -> PayProfile:
    profile = PayProfile(**profile_data.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/{profile_id}", response_model=PayProfileRead)
def update_pay_profile(
    profile_id: int,
    profile_data: PayProfileUpdate,
    db: Session = Depends(get_db),
) -> PayProfile:
    profile = get_profile_or_404(profile_id, db)
    for field, value in profile_data.model_dump().items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{profile_id}")
def delete_pay_profile(profile_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    profile = get_profile_or_404(profile_id, db)
    db.delete(profile)
    db.commit()
    return {"message": "Pay profile deleted successfully."}
