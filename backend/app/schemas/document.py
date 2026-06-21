from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.document_folder import DocumentFolderRead


class DocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=100)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("title", "category")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("notes")
    @classmethod
    def normalize_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class DocumentRead(DocumentCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    original_filename: str
    stored_filename: str
    file_path: str
    content_type: str
    file_size: int
    folder_id: int | None
    folder: DocumentFolderRead | None
    uploaded_at: datetime


class DocumentSummary(BaseModel):
    total_documents: int
    total_storage_bytes: int
    latest_upload_date: datetime | None
