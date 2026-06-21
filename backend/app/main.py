from contextlib import asynccontextmanager
import os
from time import monotonic

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import (
    APP_ENV,
    BACKUP_DIR,
    CORS_ORIGINS,
    DOCUMENT_FOLDERS_DIR,
    DOCUMENT_UPLOAD_DIR,
)
from app.database import (
    Base,
    engine,
    ensure_document_folder_column,
    ensure_expense_recurring_columns,
    ensure_note_link_columns,
    ensure_pay_profile_columns,
)
from app.routes import (
    backups_router,
    document_folders_router,
    documents_router,
    expenses_router,
    notes_router,
    pay_profiles_router,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    DOCUMENT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    DOCUMENT_FOLDERS_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    ensure_document_folder_column()
    ensure_note_link_columns()
    ensure_pay_profile_columns()
    ensure_expense_recurring_columns()
    yield


app = FastAPI(title="CandyVault API", lifespan=lifespan)
APP_STARTED_AT = monotonic()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(expenses_router)
app.include_router(documents_router)
app.include_router(notes_router)
app.include_router(document_folders_router)
app.include_router(backups_router)
app.include_router(pay_profiles_router)


@app.get("/")
def root():
    return {
        "app": "CandyVault",
        "status": "online"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.get("/system/status")
def system_status():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        database_status = "healthy"
    except Exception:
        database_status = "unavailable"

    def directory_status(path):
        return "ready" if path.is_dir() and os.access(path, os.W_OK) else "unavailable"

    return {
        "app_name": "CandyVault",
        "environment": APP_ENV,
        "database_status": database_status,
        "uploads_directory_status": directory_status(DOCUMENT_UPLOAD_DIR),
        "backups_directory_status": directory_status(BACKUP_DIR),
        "uptime_seconds": round(monotonic() - APP_STARTED_AT, 2),
    }
