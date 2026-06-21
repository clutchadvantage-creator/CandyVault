from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DocumentFolderFields(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class DocumentFolderCreate(DocumentFolderFields):
    pass


class DocumentFolderUpdate(DocumentFolderFields):
    pass


class DocumentFolderRead(DocumentFolderFields):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    created_at: datetime
    updated_at: datetime
