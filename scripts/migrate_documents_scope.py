"""
Migration: Add company_scope and notes columns to project_documents.
Run against existing sietch_crm database to enable:
- company_scope: marks a document as company-shared (vs project or personal)
- notes: optional user notes/description per document

Existing project documents (opportunity_id IS NOT NULL) are unaffected.
Existing personal docs (uploaded_by set, no opp, no company_scope) work as-is.
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

    # 1. Add company_scope column
    print("Adding company_scope column...")
    cur.execute("""
        ALTER TABLE project_documents
        ADD COLUMN company_scope BOOLEAN NOT NULL DEFAULT FALSE;
    """)
    print("  ✓ company_scope added")

    # 2. Add notes column
    print("Adding notes column...")
    cur.execute("""
        ALTER TABLE project_documents
        ADD COLUMN notes TEXT;
    """)
    print("  ✓ notes added")

    # 3. Create company_scope index
    print("Creating company_scope index...")
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_documents_company
        ON project_documents(company_scope) WHERE company_scope = TRUE;
    """)
    print("  ✓ idx_documents_company created")

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
