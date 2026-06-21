from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class NoteFields(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=10_000)
    category: str = Field(min_length=1, max_length=100)
    linked_type: Literal["expense", "document"] | None = None
    linked_id: int | None = Field(default=None, gt=0)

    @field_validator("title", "content", "category")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @model_validator(mode="after")
    def validate_link_pair(self) -> "NoteFields":
        if (self.linked_type is None) != (self.linked_id is None):
            raise ValueError("linked_type and linked_id must be provided together")
        return self


class NoteCreate(NoteFields):
    pass


class NoteUpdate(NoteFields):
    pass


class NoteRead(NoteFields):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class NoteSummary(BaseModel):
    total_notes: int
    latest_note_date: datetime | None
