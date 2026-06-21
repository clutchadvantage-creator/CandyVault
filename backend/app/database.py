from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import DATABASE_URL


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def ensure_note_link_columns() -> None:
    """Compatibility migration for local SQLite databases created before Phase 7."""
    if engine.dialect.name != "sqlite" or "notes" not in inspect(engine).get_table_names():
        return

    existing_columns = {column["name"] for column in inspect(engine).get_columns("notes")}
    with engine.begin() as connection:
        if "linked_type" not in existing_columns:
            connection.execute(text("ALTER TABLE notes ADD COLUMN linked_type VARCHAR(20)"))
        if "linked_id" not in existing_columns:
            connection.execute(text("ALTER TABLE notes ADD COLUMN linked_id INTEGER"))
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_notes_linked_item "
                "ON notes (linked_type, linked_id)"
            )
        )


def ensure_document_folder_column() -> None:
    """Compatibility migration for local SQLite databases created before Phase 9."""
    if engine.dialect.name != "sqlite" or "documents" not in inspect(engine).get_table_names():
        return

    existing_columns = {column["name"] for column in inspect(engine).get_columns("documents")}
    with engine.begin() as connection:
        if "folder_id" not in existing_columns:
            connection.execute(
                text(
                    "ALTER TABLE documents ADD COLUMN folder_id INTEGER "
                    "REFERENCES document_folders(id)"
                )
            )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_documents_folder_id "
                "ON documents (folder_id)"
            )
        )


def ensure_pay_profile_columns() -> None:
    """Compatibility migration for pay profiles created before overtime/tax estimates."""
    if engine.dialect.name != "sqlite" or "pay_profiles" not in inspect(engine).get_table_names():
        return

    existing_columns = {column["name"] for column in inspect(engine).get_columns("pay_profiles")}
    column_definitions = {
        "overtime_enabled": "BOOLEAN NOT NULL DEFAULT 0",
        "overtime_rate_multiplier": "NUMERIC(5, 2) NOT NULL DEFAULT 1.5",
        "overtime_hours_per_week": "NUMERIC(6, 2) NOT NULL DEFAULT 0",
        "overtime_notes": "TEXT",
        "federal_tax_percent": "NUMERIC(5, 2) NOT NULL DEFAULT 0",
        "state_tax_percent": "NUMERIC(5, 2) NOT NULL DEFAULT 0",
        "local_tax_percent": "NUMERIC(5, 2) NOT NULL DEFAULT 0",
        "other_deductions_percent": "NUMERIC(5, 2) NOT NULL DEFAULT 0",
        "other_deductions_amount": "NUMERIC(12, 2) NOT NULL DEFAULT 0",
    }
    with engine.begin() as connection:
        for column_name, definition in column_definitions.items():
            if column_name not in existing_columns:
                connection.execute(
                    text(f"ALTER TABLE pay_profiles ADD COLUMN {column_name} {definition}")
                )


def ensure_expense_recurring_columns() -> None:
    """Compatibility migration for expenses created before recurring metadata."""
    if engine.dialect.name != "sqlite" or "expenses" not in inspect(engine).get_table_names():
        return

    existing_columns = {column["name"] for column in inspect(engine).get_columns("expenses")}
    with engine.begin() as connection:
        if "is_recurring" not in existing_columns:
            connection.execute(
                text("ALTER TABLE expenses ADD COLUMN is_recurring BOOLEAN NOT NULL DEFAULT 0")
            )
        if "recurrence_frequency" not in existing_columns:
            connection.execute(
                text("ALTER TABLE expenses ADD COLUMN recurrence_frequency VARCHAR(20)")
            )
        if "recurrence_notes" not in existing_columns:
            connection.execute(
                text("ALTER TABLE expenses ADD COLUMN recurrence_notes VARCHAR(500)")
            )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_expenses_is_recurring "
                "ON expenses (is_recurring)"
            )
        )


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
