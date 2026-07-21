"""
Migration: Add document_folders table and folder_id column to project_documents.
Enables nested folder navigation in Personal and Company document scopes.
"""
import psycopg2
import sys
import os

def get_conn():
    DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "sietch_crm")
    DB_USER = os.getenv("DB_USER", "sietch_crm")
    DB_PASS = os.getenv("DB_PASS", "sietch_crm")
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASS
    )

def migrate(conn):
    cur = conn.cursor()

    # 1. Create document_folders table
    print("Creating document_folders table...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS document_folders (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            parent_id INTEGER REFERENCES document_folders(id) ON DELETE CASCADE,
            scope TEXT NOT NULL CHECK (scope IN ('personal', 'company')),
            uploaded_by INTEGER REFERENCES users(id),
            created_at TIMESTAMP DEFAULT NOW(),
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE
        );
    """)
    print("  ✓ document_folders created")

    # 2. Add folder_id column to project_documents
    print("Adding folder_id column to project_documents...")
    cur.execute("""
        ALTER TABLE project_documents
        ADD COLUMN folder_id INTEGER REFERENCES document_folders(id);
    """)
    print("  ✓ folder_id added")

    # 3. Create indexes
    print("Creating indexes...")
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_doc_folders_parent
        ON document_folders(parent_id) WHERE is_deleted = FALSE;
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_doc_folders_scope
        ON document_folders(scope, uploaded_by) WHERE is_deleted = FALSE;
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_project_documents_folder
        ON project_documents(folder_id) WHERE folder_id IS NOT NULL;
    """)
    print("  ✓ indexes created")

    conn.commit()
    cur.close()
    print("\nMigration complete ✓")


if __name__ == "__main__":
    try:
        conn = get_conn()
        migrate(conn)
        conn.close()
    except psycopg2.Error as e:
        print(f"Database error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
