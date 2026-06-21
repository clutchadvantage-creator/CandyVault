from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Document, Expense, Note
from app.schemas import NoteCreate, NoteRead, NoteSummary, NoteUpdate


router = APIRouter(prefix="/notes", tags=["notes"])


def get_note_or_404(note_id: int, db: Session) -> Note:
    note = db.get(Note, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found.")
    return note


def ensure_link_target_exists(
    linked_type: Literal["expense", "document"],
    linked_id: int,
    db: Session,
) -> None:
    model = Expense if linked_type == "expense" else Document
    if db.get(model, linked_id) is None:
        raise HTTPException(status_code=404, detail=f"Linked {linked_type} not found.")


@router.get("", response_model=list[NoteRead])
def list_notes(
    search: Annotated[str | None, Query(max_length=255)] = None,
    category: Annotated[str | None, Query(max_length=100)] = None,
    linked_type: Literal["standalone", "expense", "document"] | None = None,
    sort_by: Literal["updated_at", "created_at", "title", "category"] = "updated_at",
    sort_dir: Literal["asc", "desc"] = "desc",
    db: Session = Depends(get_db),
) -> list[Note]:
    statement = select(Note)
    if search and (search_term := search.strip()):
        pattern = f"%{search_term}%"
        statement = statement.where(
            or_(
                Note.title.ilike(pattern),
                Note.content.ilike(pattern),
                Note.category.ilike(pattern),
            )
        )
    if category and (category_value := category.strip()):
        statement = statement.where(func.lower(Note.category) == category_value.lower())
    if linked_type == "standalone":
        statement = statement.where(Note.linked_type.is_(None), Note.linked_id.is_(None))
    elif linked_type:
        statement = statement.where(Note.linked_type == linked_type)

    sort_columns = {
        "updated_at": Note.updated_at,
        "created_at": Note.created_at,
        "title": Note.title,
        "category": Note.category,
    }
    sort_column = sort_columns[sort_by]
    order = sort_column.asc() if sort_dir == "asc" else sort_column.desc()
    id_order = Note.id.asc() if sort_dir == "asc" else Note.id.desc()
    statement = statement.order_by(order, id_order)
    return list(db.scalars(statement).all())


@router.get("/summary", response_model=NoteSummary)
def get_note_summary(db: Session = Depends(get_db)) -> NoteSummary:
    count, latest = db.execute(
        select(func.count(Note.id), func.max(Note.updated_at))
    ).one()
    return NoteSummary(total_notes=count, latest_note_date=latest)


@router.get("/linked/{linked_type}/{linked_id}", response_model=list[NoteRead])
def list_linked_notes(
    linked_type: Literal["expense", "document"],
    linked_id: int,
    db: Session = Depends(get_db),
) -> list[Note]:
    statement = (
        select(Note)
        .where(Note.linked_type == linked_type, Note.linked_id == linked_id)
        .order_by(Note.updated_at.desc(), Note.id.desc())
    )
    return list(db.scalars(statement).all())


@router.post(
    "/linked/{linked_type}/{linked_id}",
    response_model=NoteRead,
    status_code=status.HTTP_201_CREATED,
)
def create_linked_note(
    linked_type: Literal["expense", "document"],
    linked_id: int,
    note_data: NoteCreate,
    db: Session = Depends(get_db),
) -> Note:
    ensure_link_target_exists(linked_type, linked_id, db)
    note_fields = note_data.model_dump(exclude={"linked_type", "linked_id"})
    note = Note(**note_fields, linked_type=linked_type, linked_id=linked_id)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/{note_id}", response_model=NoteRead)
def get_note(note_id: int, db: Session = Depends(get_db)) -> Note:
    return get_note_or_404(note_id, db)


@router.post("", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
def create_note(note_data: NoteCreate, db: Session = Depends(get_db)) -> Note:
    if note_data.linked_type is not None and note_data.linked_id is not None:
        ensure_link_target_exists(note_data.linked_type, note_data.linked_id, db)
    note = Note(**note_data.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.put("/{note_id}", response_model=NoteRead)
def update_note(
    note_id: int,
    note_data: NoteUpdate,
    db: Session = Depends(get_db),
) -> Note:
    note = get_note_or_404(note_id, db)
    if note_data.linked_type is not None and note_data.linked_id is not None:
        ensure_link_target_exists(note_data.linked_type, note_data.linked_id, db)
    for field, value in note_data.model_dump().items():
        setattr(note, field, value)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    note = get_note_or_404(note_id, db)
    db.delete(note)
    db.commit()
    return {"message": "Note deleted successfully."}
