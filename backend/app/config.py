import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

APP_ENV = os.getenv("APP_ENV", "development").strip() or "development"
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./candyvault.db")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "uploads")).resolve()
DOCUMENT_UPLOAD_DIR = Path(
    os.getenv("DOCUMENT_UPLOAD_DIR", UPLOAD_DIR / "documents")
).resolve()
DOCUMENT_FOLDERS_DIR = (DOCUMENT_UPLOAD_DIR / "folders").resolve()
BACKUP_DIR = Path(os.getenv("BACKUP_DIR", BASE_DIR / "backups")).resolve()
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "25"))
MAX_DOCUMENT_SIZE_BYTES = int(
    os.getenv("MAX_DOCUMENT_SIZE_BYTES", str(MAX_UPLOAD_MB * 1024 * 1024))
)
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
