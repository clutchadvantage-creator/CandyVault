from datetime import datetime
from typing import Any

from pydantic import BaseModel


class BackupRead(BaseModel):
    filename: str
    file_size: int
    created_at: datetime
    total_files: int


class BackupInspect(BaseModel):
    filename: str
    size: int
    created_at: datetime
    manifest: dict[str, Any]
    included_file_count: int
    included_database_file: bool
    included_uploads: bool
    included_document_folders: bool
    warnings: list[str]


class BackupHealth(BaseModel):
    total_backups: int
    latest_backup_date: datetime | None
    total_backup_storage: int
    database_file_exists: bool
    uploads_directory_exists: bool
    backup_directory_exists: bool
    warnings: list[str]
