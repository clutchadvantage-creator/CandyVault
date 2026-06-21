import re
import unicodedata
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import DOCUMENT_FOLDERS_DIR
from app.database import get_db
from app.models import Document, DocumentFolder
from app.schemas import DocumentFolderCreate, DocumentFolderRead, DocumentFolderUpdate


router = APIRouter(prefix="/document-folders", tags=["document-folders"])
DANGEROUS_NAME_PATTERN = re.compile(r"[<>:\"/\\|?*\x00-\x1f]")


def safe_slug(name: str) -> str:
    if name in {".", ".."} or ".." in name or DANGEROUS_NAME_PATTERN.search(name):
        raise HTTPException(
            status_code=422,
            detail="Folder names cannot contain slashes, path traversal, or dangerous characters.",
        )
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    if not slug or len(slug) > 120:
        raise HTTPException(status_code=422, detail="Folder name cannot produce a safe folder path.")
    return slug


def folder_path(slug: str) -> Path:
    root = DOCUMENT_FOLDERS_DIR.resolve()
    path = (root / slug).resolve()
    if not path.is_relative_to(root):
        raise HTTPException(status_code=400, detail="Folder path is invalid.")
    return path


def get_folder_or_404(folder_id: int, db: Session) -> DocumentFolder:
    folder = db.get(DocumentFolder, folder_id)
    if folder is None:
        raise HTTPException(status_code=404, detail="Document folder not found.")
    return folder


def ensure_folder_unique(
    name: str,
    slug: str,
    db: Session,
    exclude_id: int | None = None,
) -> None:
    statement = select(DocumentFolder).where(
        or_(func.lower(DocumentFolder.name) == name.lower(), DocumentFolder.slug == slug)
    )
    if exclude_id is not None:
        statement = statement.where(DocumentFolder.id != exclude_id)
    if db.scalar(statement) is not None:
        raise HTTPException(status_code=409, detail="A folder with that name or slug already exists.")


@router.get("", response_model=list[DocumentFolderRead])
def list_folders(db: Session = Depends(get_db)) -> list[DocumentFolder]:
    statement = select(DocumentFolder).order_by(func.lower(DocumentFolder.name), DocumentFolder.id)
    return list(db.scalars(statement).all())


@router.post("", response_model=DocumentFolderRead, status_code=status.HTTP_201_CREATED)
def create_folder(
    folder_data: DocumentFolderCreate,
    db: Session = Depends(get_db),
) -> DocumentFolder:
    slug = safe_slug(folder_data.name)
    ensure_folder_unique(folder_data.name, slug, db)
    path = folder_path(slug)
    if path.exists():
        raise HTTPException(status_code=409, detail="A physical folder with that slug already exists.")

    try:
        path.mkdir(parents=True, exist_ok=False)
        folder = DocumentFolder(**folder_data.model_dump(), slug=slug)
        db.add(folder)
        db.commit()
        db.refresh(folder)
        return folder
    except IntegrityError as exc:
        db.rollback()
        path.rmdir()
        raise HTTPException(status_code=409, detail="Folder name or slug already exists.") from exc
    except OSError as exc:
        db.rollback()
        if path.exists() and not any(path.iterdir()):
            path.rmdir()
        raise HTTPException(status_code=500, detail="The physical folder could not be created.") from exc


@router.get("/{folder_id}", response_model=DocumentFolderRead)
def get_folder(folder_id: int, db: Session = Depends(get_db)) -> DocumentFolder:
    return get_folder_or_404(folder_id, db)


@router.put("/{folder_id}", response_model=DocumentFolderRead)
def update_folder(
    folder_id: int,
    folder_data: DocumentFolderUpdate,
    db: Session = Depends(get_db),
) -> DocumentFolder:
    folder = get_folder_or_404(folder_id, db)
    new_slug = safe_slug(folder_data.name)
    ensure_folder_unique(folder_data.name, new_slug, db, exclude_id=folder.id)
    old_path = folder_path(folder.slug)
    new_path = folder_path(new_slug)
    renamed = False

    try:
        if new_slug != folder.slug:
            if not old_path.is_dir():
                raise HTTPException(status_code=500, detail="The physical folder is missing.")
            if new_path.exists():
                raise HTTPException(status_code=409, detail="A physical folder with that slug already exists.")
            old_path.rename(new_path)
            renamed = True
            documents = db.scalars(select(Document).where(Document.folder_id == folder.id)).all()
            for document in documents:
                document.file_path = str((new_path / document.stored_filename).resolve())

        folder.name = folder_data.name
        folder.slug = new_slug
        folder.description = folder_data.description
        db.commit()
        db.refresh(folder)
        return folder
    except HTTPException:
        db.rollback()
        if renamed and new_path.exists() and not old_path.exists():
            new_path.rename(old_path)
        raise
    except (OSError, SQLAlchemyError) as exc:
        db.rollback()
        if renamed and new_path.exists() and not old_path.exists():
            new_path.rename(old_path)
        raise HTTPException(status_code=500, detail="The folder could not be updated.") from exc


@router.delete("/{folder_id}")
def delete_folder(folder_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    folder = get_folder_or_404(folder_id, db)
    document_count = db.scalar(
        select(func.count(Document.id)).where(Document.folder_id == folder.id)
    )
    if document_count:
        raise HTTPException(status_code=409, detail="Only empty document folders can be deleted.")

    path = folder_path(folder.slug)
    if path.exists() and any(path.iterdir()):
        raise HTTPException(status_code=409, detail="The physical folder is not empty.")

    try:
        if path.exists():
            path.rmdir()
        db.delete(folder)
        db.commit()
    except (OSError, SQLAlchemyError) as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="The folder could not be deleted.") from exc

    return {"message": "Document folder deleted successfully."}
