from app.routes.document_folders import router as document_folders_router
from app.routes.documents import router as documents_router
from app.routes.expenses import router as expenses_router
from app.routes.notes import router as notes_router
from app.routes.pay_profiles import router as pay_profiles_router

__all__ = [
    "backups_router",
    "document_folders_router",
    "documents_router",
    "expenses_router",
    "notes_router",
    "pay_profiles_router",
]
from app.routes.backups import router as backups_router
