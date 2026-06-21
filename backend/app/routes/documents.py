import re
from pathlib import Path
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from app.config import DOCUMENT_UPLOAD_DIR, MAX_DOCUMENT_SIZE_BYTES
from app.database import get_db
from app.models import Document, DocumentFolder
from app.schemas import DocumentCreate, DocumentRead, DocumentSummary


router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_FILE_TYPES = {
    ".pdf": {"application/pdf"},
    ".png": {"image/png"},
    ".jpg": {"image/jpeg", "image/jpg"},
    ".jpeg": {"image/jpeg", "image/jpg"},
    ".txt": {"text/plain"},
    ".doc": {"application/msword"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    ".xls": {"application/vnd.ms-excel"},
    ".xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
}
GENERIC_CONTENT_TYPES = {"", "application/octet-stream"}
FILE_CHUNK_SIZE = 1024 * 1024


def sanitize_filename(filename: str | None) -> str:
    basename = re.split(r"[\\/]", filename or "")[-1].strip()
    sanitized = re.sub(r"[^A-Za-z0-9._ ()-]", "_", basename)
    return sanitized.strip(" .")[:255]


def get_document_or_404(document_id: int, db: Session) -> Document:
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return document


def resolve_stored_file(document: Document) -> Path:
    upload_root = DOCUMENT_UPLOAD_DIR.resolve()
    file_path = Path(document.file_path).resolve()
    if not file_path.is_relative_to(upload_root) or not file_path.is_file():
        raise HTTPException(status_code=404, detail="The stored document file could not be found.")
    return file_path


@router.get("", response_model=list[DocumentRead])
def list_documents(
    search: Annotated[str | None, Query(max_length=255)] = None,
    category: Annotated[str | None, Query(max_length=100)] = None,
    content_type: Annotated[str | None, Query(max_length=255)] = None,
    folder_id: Annotated[int | None, Query(gt=0)] = None,
    sort_by: Literal["uploaded_at", "title", "category", "file_size"] = "uploaded_at",
    sort_dir: Literal["asc", "desc"] = "desc",
    db: Session = Depends(get_db),
) -> list[Document]:
    statement = select(Document).options(joinedload(Document.folder))
    if search and (search_term := search.strip()):
        pattern = f"%{search_term}%"
        statement = statement.where(
            or_(
                Document.title.ilike(pattern),
                Document.category.ilike(pattern),
                Document.original_filename.ilike(pattern),
                Document.notes.ilike(pattern),
            )
        )
    if category and (category_value := category.strip()):
        statement = statement.where(func.lower(Document.category) == category_value.lower())
    if content_type and (content_type_value := content_type.strip()):
        statement = statement.where(Document.content_type == content_type_value.lower())
    if folder_id is not None:
        statement = statement.where(Document.folder_id == folder_id)

    sort_columns = {
        "uploaded_at": Document.uploaded_at,
        "title": Document.title,
        "category": Document.category,
        "file_size": Document.file_size,
    }
    sort_column = sort_columns[sort_by]
    order = sort_column.asc() if sort_dir == "asc" else sort_column.desc()
    id_order = Document.id.asc() if sort_dir == "asc" else Document.id.desc()
    statement = statement.order_by(order, id_order)
    return list(db.scalars(statement).all())


@router.get("/summary", response_model=DocumentSummary)
def get_document_summary(db: Session = Depends(get_db)) -> DocumentSummary:
    count, storage, latest = db.execute(
        select(
            func.count(Document.id),
            func.coalesce(func.sum(Document.file_size), 0),
            func.max(Document.uploaded_at),
        )
    ).one()
    return DocumentSummary(
        total_documents=count,
        total_storage_bytes=storage,
        latest_upload_date=latest,
    )


@router.post("/upload", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
def upload_document(
    file: Annotated[UploadFile, File()],
    title: Annotated[str, Form(max_length=255)],
    category: Annotated[str, Form(max_length=100)],
    notes: Annotated[str | None, Form(max_length=2000)] = None,
    folder_id: Annotated[int | None, Form(gt=0)] = None,
    db: Session = Depends(get_db),
) -> Document:
    original_filename = sanitize_filename(file.filename)
    if not original_filename:
        raise HTTPException(status_code=400, detail="Choose a file with a valid filename.")

    extension = Path(original_filename).suffix.lower()
    allowed_content_types = ALLOWED_FILE_TYPES.get(extension)
    if allowed_content_types is None:
        allowed = ", ".join(sorted(ALLOWED_FILE_TYPES))
        raise HTTPException(status_code=415, detail=f"Unsupported file type. Allowed: {allowed}.")

    supplied_content_type = (file.content_type or "").lower()
    if supplied_content_type not in allowed_content_types | GENERIC_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="The file content type does not match its extension.")

    try:
        metadata = DocumentCreate(title=title, category=category, notes=notes)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors(include_url=False)) from exc

    folder = None
    destination_dir = DOCUMENT_UPLOAD_DIR
    if folder_id is not None:
        folder = db.get(DocumentFolder, folder_id)
        if folder is None:
            raise HTTPException(status_code=404, detail="Document folder not found.")
        destination_dir = (DOCUMENT_UPLOAD_DIR / "folders" / folder.slug).resolve()

    destination_dir.mkdir(parents=True, exist_ok=True)
    stored_filename = f"{uuid4().hex}{extension}"
    file_path = (destination_dir / stored_filename).resolve()
    file_size = 0

    try:
        with file_path.open("xb") as destination:
            while chunk := file.file.read(FILE_CHUNK_SIZE):
                file_size += len(chunk)
                if file_size > MAX_DOCUMENT_SIZE_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File is too large. Maximum size is {MAX_DOCUMENT_SIZE_BYTES // (1024 * 1024)} MB.",
                    )
                destination.write(chunk)

        if file_size == 0:
            raise HTTPException(status_code=400, detail="Empty files cannot be uploaded.")

        document = Document(
            **metadata.model_dump(),
            original_filename=original_filename,
            stored_filename=stored_filename,
            file_path=str(file_path),
            content_type=supplied_content_type or next(iter(allowed_content_types)),
            file_size=file_size,
            folder_id=folder.id if folder else None,
        )
        db.add(document)
        db.commit()
        db.refresh(document)
        return document
    except HTTPException:
        file_path.unlink(missing_ok=True)
        raise
    except (OSError, SQLAlchemyError) as exc:
        db.rollback()
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="The document could not be stored.") from exc


@router.get("/{document_id}/download")
def download_document(document_id: int, db: Session = Depends(get_db)) -> FileResponse:
    document = get_document_or_404(document_id, db)
    file_path = resolve_stored_file(document)
    return FileResponse(
        path=file_path,
        media_type=document.content_type,
        filename=document.original_filename,
        content_disposition_type="attachment",
    )


@router.get("/{document_id}/view")
def view_document(document_id: int, db: Session = Depends(get_db)) -> FileResponse:
    document = get_document_or_404(document_id, db)
    file_path = resolve_stored_file(document)
    return FileResponse(
        path=file_path,
        media_type=document.content_type,
        filename=document.original_filename,
        content_disposition_type="inline",
    )


@router.delete("/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    # TODO: Add an explicit cascade/archive policy for linked notes in a future phase.
    document = get_document_or_404(document_id, db)
    file_path = Path(document.file_path).resolve()
    upload_root = DOCUMENT_UPLOAD_DIR.resolve()

    if not file_path.is_relative_to(upload_root):
        raise HTTPException(status_code=400, detail="The document path is invalid.")

    try:
        file_path.unlink(missing_ok=True)
        db.delete(document)
        db.commit()
    except (OSError, SQLAlchemyError) as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="The document could not be deleted.") from exc

    return {"message": "Document deleted successfully."}
