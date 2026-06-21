import json
import os
import re
import sqlite3
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from app.config import BACKUP_DIR, BASE_DIR, DOCUMENT_FOLDERS_DIR, DOCUMENT_UPLOAD_DIR
from app.database import engine
from app.schemas import BackupHealth, BackupInspect, BackupRead


router = APIRouter(prefix="/backups", tags=["backups"])
BACKUP_NAME_PATTERN = re.compile(r"^candyvault-backup-\d{8}-\d{6}\.zip$")


def sqlite_database_path() -> Path:
    if engine.dialect.name != "sqlite" or not engine.url.database:
        raise HTTPException(status_code=400, detail="Backups currently require a file-based SQLite database.")
    path = Path(engine.url.database)
    if not path.is_absolute():
        path = BASE_DIR / path
    path = path.resolve()
    if not path.is_file():
        raise HTTPException(status_code=404, detail="SQLite database file was not found.")
    return path


def safe_backup_path(filename: str, require_exists: bool = True) -> Path:
    if Path(filename).name != filename or not BACKUP_NAME_PATTERN.fullmatch(filename):
        raise HTTPException(status_code=400, detail="Invalid backup filename.")
    root = BACKUP_DIR.resolve()
    path = (root / filename).resolve()
    if not path.is_relative_to(root):
        raise HTTPException(status_code=400, detail="Invalid backup path.")
    if require_exists and not path.is_file():
        raise HTTPException(status_code=404, detail="Backup not found.")
    return path


def read_total_files(path: Path) -> int:
    try:
        with zipfile.ZipFile(path) as archive:
            manifest = json.loads(archive.read("backup-manifest.json"))
            return int(manifest.get("total_files", 0))
    except (OSError, KeyError, ValueError, zipfile.BadZipFile, json.JSONDecodeError):
        return 0


def backup_metadata(path: Path) -> BackupRead:
    stat = path.stat()
    return BackupRead(
        filename=path.name,
        file_size=stat.st_size,
        created_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
        total_files=read_total_files(path),
    )


def available_backup_paths() -> list[Path]:
    if not BACKUP_DIR.is_dir():
        return []
    backups = [
        path
        for path in BACKUP_DIR.iterdir()
        if path.is_file() and BACKUP_NAME_PATTERN.fullmatch(path.name)
    ]
    backups.sort(key=lambda path: path.stat().st_mtime, reverse=True)
    return backups


def inspect_archive(path: Path) -> BackupInspect:
    warnings: list[str] = []
    manifest: dict = {}
    try:
        with zipfile.ZipFile(path) as archive:
            infos = archive.infolist()
            names = {info.filename for info in infos}
            file_names = [info.filename for info in infos if not info.is_dir()]

            unsafe_entries = [
                name
                for name in names
                if name.startswith(("/", "\\"))
                or "\\" in name
                or ".." in Path(name).parts
            ]
            if unsafe_entries:
                warnings.append("Archive contains unsafe path entries and must not be restored.")

            try:
                manifest_data = json.loads(archive.read("backup-manifest.json"))
                if isinstance(manifest_data, dict):
                    manifest = manifest_data
                else:
                    warnings.append("Backup manifest is not a JSON object.")
            except KeyError:
                warnings.append("Backup manifest is missing.")
            except (UnicodeDecodeError, json.JSONDecodeError):
                warnings.append("Backup manifest is invalid JSON.")

            database_entry = manifest.get("database_file")
            included_database = bool(
                isinstance(database_entry, str) and database_entry in names
            ) or any(name.startswith("database/") and name.endswith(".db") for name in names)
            included_uploads = any(name.startswith("uploads/documents/") for name in names)
            included_folders = any(
                name.startswith("uploads/documents/folders/") for name in names
            )

            if not included_database:
                warnings.append("SQLite database file is missing from this backup.")
            if not included_uploads:
                warnings.append("Documents upload path is missing from this backup.")
            if not included_folders:
                warnings.append("Document folder structure is missing from this backup.")

            manifest_total = manifest.get("total_files")
            if isinstance(manifest_total, int) and manifest_total != len(file_names):
                warnings.append("Manifest file count does not match the ZIP contents.")

            corrupt_entry = archive.testzip()
            if corrupt_entry:
                warnings.append(f"Archive integrity check failed at {corrupt_entry}.")

            metadata = backup_metadata(path)
            return BackupInspect(
                filename=path.name,
                size=metadata.file_size,
                created_at=metadata.created_at,
                manifest=manifest,
                included_file_count=len(file_names),
                included_database_file=included_database,
                included_uploads=included_uploads,
                included_document_folders=included_folders,
                warnings=warnings,
            )
    except (OSError, zipfile.BadZipFile) as exc:
        raise HTTPException(status_code=422, detail="Backup ZIP is unreadable or corrupt.") from exc


@router.post("/create", response_model=BackupRead, status_code=status.HTTP_201_CREATED)
def create_backup() -> BackupRead:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    DOCUMENT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    DOCUMENT_FOLDERS_DIR.mkdir(parents=True, exist_ok=True)
    created_at = datetime.now(timezone.utc)
    filename = f"candyvault-backup-{created_at.strftime('%Y%m%d-%H%M%S')}.zip"
    destination = safe_backup_path(filename, require_exists=False)
    if destination.exists():
        raise HTTPException(status_code=409, detail="A backup was already created this second. Try again.")

    database_path = sqlite_database_path()
    temporary_archive = BACKUP_DIR / f".creating-{uuid4().hex}.zip"

    try:
        with tempfile.TemporaryDirectory(dir=BACKUP_DIR) as temporary_dir:
            snapshot_path = Path(temporary_dir) / database_path.name
            source_db = sqlite3.connect(f"file:{database_path}?mode=ro", uri=True)
            snapshot_db = sqlite3.connect(snapshot_path)
            try:
                source_db.backup(snapshot_db)
            finally:
                snapshot_db.close()
                source_db.close()

            upload_files = [path for path in DOCUMENT_UPLOAD_DIR.rglob("*") if path.is_file()]
            manifest = {
                "created_at": created_at.isoformat(),
                "app_name": "CandyVault",
                "database_file": f"database/{database_path.name}",
                "included_paths": [
                    f"database/{database_path.name}",
                    "uploads/documents/",
                    "uploads/documents/folders/",
                ],
                "total_files": len(upload_files) + 2,
                "backup_version": 1,
            }

            with zipfile.ZipFile(
                temporary_archive, mode="x", compression=zipfile.ZIP_DEFLATED
            ) as archive:
                archive.write(snapshot_path, arcname=f"database/{database_path.name}")
                archive.writestr("uploads/documents/", "")
                archive.writestr("uploads/documents/folders/", "")
                written_directories = {
                    "uploads/documents/",
                    "uploads/documents/folders/",
                }
                for path in DOCUMENT_UPLOAD_DIR.rglob("*"):
                    relative = path.relative_to(DOCUMENT_UPLOAD_DIR).as_posix()
                    archive_name = f"uploads/documents/{relative}"
                    if path.is_dir():
                        directory_name = f"{archive_name}/"
                        if directory_name not in written_directories:
                            archive.writestr(directory_name, "")
                            written_directories.add(directory_name)
                    else:
                        archive.write(path, arcname=archive_name)
                archive.writestr("backup-manifest.json", json.dumps(manifest, indent=2))

            os.replace(temporary_archive, destination)
    except HTTPException:
        temporary_archive.unlink(missing_ok=True)
        raise
    except (OSError, sqlite3.Error, zipfile.BadZipFile) as exc:
        temporary_archive.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Backup creation failed.") from exc

    return backup_metadata(destination)


@router.get("", response_model=list[BackupRead])
def list_backups() -> list[BackupRead]:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    return [backup_metadata(path) for path in available_backup_paths()]


@router.get("/health", response_model=BackupHealth)
def backup_health() -> BackupHealth:
    backup_directory_exists = BACKUP_DIR.is_dir()
    uploads_directory_exists = DOCUMENT_UPLOAD_DIR.is_dir()
    try:
        database_file_exists = sqlite_database_path().is_file()
    except HTTPException:
        database_file_exists = False

    backups = available_backup_paths()
    warnings: list[str] = []
    if not database_file_exists:
        warnings.append("SQLite database file is missing.")
    if not uploads_directory_exists:
        warnings.append("Documents upload directory is missing.")
    if not backup_directory_exists:
        warnings.append("Backup directory is missing.")
    if not backups:
        warnings.append("No backups are available yet.")

    return BackupHealth(
        total_backups=len(backups),
        latest_backup_date=(
            datetime.fromtimestamp(backups[0].stat().st_mtime, tz=timezone.utc)
            if backups
            else None
        ),
        total_backup_storage=sum(path.stat().st_size for path in backups),
        database_file_exists=database_file_exists,
        uploads_directory_exists=uploads_directory_exists,
        backup_directory_exists=backup_directory_exists,
        warnings=warnings,
    )


@router.get("/{backup_filename}/inspect", response_model=BackupInspect)
def inspect_backup(backup_filename: str) -> BackupInspect:
    return inspect_archive(safe_backup_path(backup_filename))


@router.get("/{backup_filename}/download")
def download_backup(backup_filename: str) -> FileResponse:
    path = safe_backup_path(backup_filename)
    return FileResponse(
        path=path,
        media_type="application/zip",
        filename=path.name,
        content_disposition_type="attachment",
    )


@router.delete("/{backup_filename}")
def delete_backup(backup_filename: str) -> dict[str, str]:
    path = safe_backup_path(backup_filename)
    try:
        path.unlink()
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Backup could not be deleted.") from exc
    return {"message": "Backup deleted successfully."}
