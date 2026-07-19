# Vanguard CRM v3.0 Migration Plan  
**Version:** 4.0 — Locked  
 **Date:** 2026-07-18  
 **Author:** Lumo (AI assistant) + project owner  
 **Status:** Approved for development  
## Table of Contents  
1. [Objective](https://lumo.proton.me/#1-objective "https://lumo.proton.me/#1-objective")  
2. [Repository Strategy](https://lumo.proton.me/#2-repository-strategy "https://lumo.proton.me/#2-repository-strategy")  
3. [Terminology Shift](https://lumo.proton.me/#3-terminology-shift-deals--projects "https://lumo.proton.me/#3-terminology-shift-deals--projects")  
4. [Current Architecture (Being Replaced)](https://lumo.proton.me/#4-current-architecture-being-replaced "https://lumo.proton.me/#4-current-architecture-being-replaced")  
5. [Target Architecture](https://lumo.proton.me/#5-target-architecture "https://lumo.proton.me/#5-target-architecture")  
6. [Deployment Topology](https://lumo.proton.me/#6-deployment-topology "https://lumo.proton.me/#6-deployment-topology")  
7. [Database Schema](https://lumo.proton.me/#7-database-schema "https://lumo.proton.me/#7-database-schema")  
8. [Migration Script](https://lumo.proton.me/#8-migration-script-migrate_from_onlyofficepy "https://lumo.proton.me/#8-migration-script-migrate_from_onlyofficepy")  
9. [Server.py Rewrite](https://lumo.proton.me/#9-serverpy-rewrite "https://lumo.proton.me/#9-serverpy-rewrite")  
10. [Frontend Changes](https://lumo.proton.me/#10-frontend-changes-publicappjs "https://lumo.proton.me/#10-frontend-changes-publicappjs")  
11. [Dashboard Tile Layout Refactoring](https://lumo.proton.me/#11-dashboard-tile-layout-refactoring "https://lumo.proton.me/#11-dashboard-tile-layout-refactoring")  
12. [Unified Admin Modal](https://lumo.proton.me/#12-unified-admin-modal "https://lumo.proton.me/#12-unified-admin-modal")  
13. [Threaded Replies in History Notes](https://lumo.proton.me/#13-threaded-replies-in-history-notes "https://lumo.proton.me/#13-threaded-replies-in-history-notes")  
14. [Photo Gallery](https://lumo.proton.me/#14-photo-gallery-per-project "https://lumo.proton.me/#14-photo-gallery-per-project")  
15. [Notifications & Feed](https://lumo.proton.me/#15-notifications--feed "https://lumo.proton.me/#15-notifications--feed")  
16. [SMTP Client](https://lumo.proton.me/#16-smtp-client "https://lumo.proton.me/#16-smtp-client")  
17. [Email Classifier Module (Deferred)](https://lumo.proton.me/#17-email-classifier-module-deferred "https://lumo.proton.me/#17-email-classifier-module-deferred")  
18. [Bidirectional Sync (Transition Period)](https://lumo.proton.me/#18-bidirectional-sync-transition-period "https://lumo.proton.me/#18-bidirectional-sync-transition-period")  
19. [Telegram Bot Changes](https://lumo.proton.me/#19-telegram-bot-changes "https://lumo.proton.me/#19-telegram-bot-changes")  
20. [Docker Compose Changes](https://lumo.proton.me/#20-docker-compose-changes "https://lumo.proton.me/#20-docker-compose-changes")  
21. [Implementation Phases](https://lumo.proton.me/#21-implementation-phases "https://lumo.proton.me/#21-implementation-phases")  
22. [Risk Mitigation](https://lumo.proton.me/#22-risk-mitigation "https://lumo.proton.me/#22-risk-mitigation")  
23. [Testing Strategy](https://lumo.proton.me/#23-testing-strategy "https://lumo.proton.me/#23-testing-strategy")  
24. [File Inventory](https://lumo.proton.me/#24-file-inventory "https://lumo.proton.me/#24-file-inventory")  
25. [What Gets Preserved](https://lumo.proton.me/#25-what-gets-preserved-no-changes "https://lumo.proton.me/#25-what-gets-preserved-no-changes")  
26. [Environment Variables](https://lumo.proton.me/#26-environment-variables-final "https://lumo.proton.me/#26-environment-variables-final")  
27. [Decisions Locked](https://lumo.proton.me/#27-decisions-locked "https://lumo.proton.me/#27-decisions-locked")  
28. [Open Questions (Resolved)](https://lumo.proton.me/#28-open-questions-resolved "https://lumo.proton.me/#28-open-questions-resolved")  
29. [Glossary](https://lumo.proton.me/#29-glossary "https://lumo.proton.me/#29-glossary")  
## 1. Objective  
Replace the OnlyOffice Community Server CRM dependency with a self-contained Vanguard CRM system. The dashboard (server.py + public/app.js + frontend) becomes a standalone CRM application backed by PostgreSQL, running in a Docker container. OnlyOffice Community Server is open source (AGPLv3) but development has been discontinued by the team. This migration eliminates all cross-server API calls, CRM API quirks, and the proxy layer, while preserving 100% of current dashboard functionality and adding new features: threaded history replies, photo gallery, inline notification replies, unified admin panel, and a subtle terminal-inspired UI refresh.  
**End state:**  
- One droplet, one Docker Compose stack (dashboard + PostgreSQL)  
- Zero API calls to OnlyOffice  
- All data owned and managed locally  
- IMAP email sync module for recording correspondence linked to projects  
- OnlyOffice droplet decommissioned after 2-week transition period  
- Email classifier module merged after core system stabilizes  
## 2. Repository Strategy  
### Decision: Branch (Not Fork)  
**Use a branch:** v3-crm-independence off main  
**Rationale:**  
- An embedded classifier email module is already in progress on a feature branch  
- That code belongs in this repo, not a separate fork  
- Single repo = easier to merge changes, unified history  
- Once v3 launches, merge back to main and deprecate old branch  
**Branch structure:**  
main                              ← Current v2.x (working production)  
 └── v3-crm-independence          ← New architecture, PostgreSQL, Projects terminology         └── email-classifier-feature  ← Feature branch for classifier work  
**Workflow:**  
1. Develop v3 locally in v3-crm-independence branch  
2. Test email classifier in parallel on its own branch  
3. Local validation complete → deploy to CRM droplet under new subdomain  
4. Keep main and v3-crm-independence in sync (backport critical bug fixes if needed)  
5. After cutover + archive period, merge v3 to main and delete old branches  
6. Email classifier merges into v3 after core system is stable post-deployment  
## 3. Terminology Shift: Deals → Projects  
Throughout the new system:  
| | |  
|-|-|  
| **Old (v2.x)** | **New (v3.0)** |   
| Opportunity | Project |   
| Deal card | Project card |   
| Deal title | Project title |   
| Opportunity ID | Project ID |   
| Deal edit | Project edit |   
| Deal preview | Project preview |   
**Implementation:**  
- Database: opportunity_* tables stay named as-is (backward compatible, no confusion)  
- API endpoints: /api/v2/projects/* instead of /api/v2/opportunities/*  
- Frontend: Replace all references in app.js, index.html, tooltips, modals, breadcrumbs  
- Telegram bot: "project" in messages instead of "deal"/"project"  
- Admin pages: "Project Manager" instead of "Opportunity Manager"  
- Email classifier (future): Links emails to projects, not deals  
**Important:** Do not rename database tables. Keep opportunity_* for simplicity. Rename at API/UI layer only.  
## 4. Current Architecture (Being Replaced)  
Dashboard Droplet (159.89.229.126)  
 └── server.py (Python proxy)         ├── public/ (vanilla JS frontend)         ├── data/user-profiles/ (JSON files)         ├── data/presence/ (JSON files)         └── PROXIES EVERYTHING →                           ↓ OnlyOffice CRM Droplet (separate server)   └── OnlyOffice Community Server (Docker)         ├── CRM API (opportunities, contacts, tasks, history, tags)         ├── Mail module (IMAP + SMTP)         ├── Auth (user accounts, sessions)         └── File storage (attachments)  
**Pain points being eliminated:**  
- Cross-server HTTPS latency on every API call  
- CRM API quirks (truncated email bodies, nested JSON, HTML sanitization, timezone shifts)  
- Proxy cache invalidation complexity  
- Mutation queue / crash resilience / 502 recovery code  
- oo_token cookie dependency on OnlyOffice auth  
- Bot authenticating to CRM as bot@vanguardadj.com  
## 5. Target Architecture  
Single Droplet (CRM Droplet — where OnlyOffice currently runs)  
 ├── Host nginx (systemd)   │     ├── /etc/nginx/sites-enabled/office.publicadjustermidwest.com   │     │     └── proxy_pass → OnlyOffice (unchanged during transition)   │     └── /etc/nginx/sites-enabled/crm.publicadjustermidwest.com   │           └── proxy_pass → 127.0.0.1:8766   │   ├── Docker Compose stack (NEW)   │     ├── vanguard-crm-v3 (Python server.py + public/)   │     │     ├── data/photos/{project_id}/   │     │     ├── data/attachments/{project_id}/   │     │     ├── db.py (PostgreSQL connection layer)   │     │     ├── auth.py (password hashing, sessions, reset tokens)   │     │     ├── smtp_client.py (SMTP relay for password reset)   │     │     ├── photo_manager.py (thumbnails, EXIF extraction)   │     │     ├── notification_engine.py (notification generation + dispatch)   │     │     ├── admin_panel.py (admin CRUD handlers)   │     │     ├── sync_worker.py (bidirectional sync with OnlyOffice)   │     │     ├── migrate_from_onlyoffice.py (one-time migration script)   │     │     ├── imap_sync.py (background IMAP sync — Phase 3+)   │     │     └── server.py (REWRITTEN — direct DB queries, no proxy)   │     │   │     └── vanguard-db (PostgreSQL 16 Alpine)   │           └── vanguard database   │                 ├── users, sessions, user_roles, password_reset_tokens   │                 ├── stages, system_settings   │                 ├── contacts   │                 ├── custom_field_definitions, custom_field_options   │                 ├── opportunities, opportunity_tags, tag_definitions   │      	          ├── opportunity_custom_field_values   │                 ├── history_categories, history_events   │                 ├── history_replies, history_attachments, history_notify_users   │                 ├── tasks   │                 ├── notifications, notification_preferences   │                 ├── project_photo_folders, project_photos, photo_exif_cache   │                 ├── mail_accounts, mail_messages, mail_deal_links, mail_flag_queue   │                 ├── sync_watermarks, opportunity_changes, sync_errors   │                 └── user_profiles   │   └── systemd services (on CRM droplet host)         ├── crm-telegram-bot-v3 (v3 bot instance)         ├── crm-imap-sync (email sync — Phase 3+)         └── crm-sync-worker (bidirectional sync with OnlyOffice — transition only)  
## 6. Deployment Topology  
### Current State (Pre-Migration)  
Dashboard Droplet (159.89.229.126)  
 └─ dashboard.publicadjustermidwest.com (v2.x production)  OnlyOffice CRM Droplet (separate)   └─ office.publicadjustermidwest.com (OnlyOffice Community Server)  
### Beta Deployment Architecture (v3.0 on CRM Droplet)  
CRM Droplet (existing OnlyOffice server)  
 ├─ Host nginx (systemd)   │   ├─ office.publicadjustermidwest.com  → OnlyOffice (stays live)   │   └─ crm.publicadjustermidwest.com     → v3.0 beta (NEW, port 8766)   │   ├─ Docker Compose stack (NEW)   │   ├─ vanguard-crm-v3 (container, port 8766)   │   │   └─ server.py + PostgreSQL (local DB)   │   └─ vanguard-db (PostgreSQL 16 Alpine)   │   └─ email-scanner (existing Docker container — dry-run mode, later phase)  Dashboard Droplet (unchanged during beta)   └─ dashboard.publicadjustermidwest.com (v2.x — users who haven't migrated yet)  Users can access either:   • dashboard.publicadjustermidwest.com (v2.x — familiar)   • crm.publicadjustermidwest.com (v3.0 — beta, new features)  Gradual migration as users prefer v3.0 over v2.x  
### Cutover Strategy (Weeks 6-8)  
- **Week 6:** v3.0 beta live on CRM droplet, bidirectional sync active  
- **Week 7-8:** Users gradually migrate to v3.0 based on confidence  
- **After 2 weeks stability:** Archive OnlyOffice droplet, redirect dashboard.publicadjustermidwest.com → crm.publicadjustermidwest.com, decommission v2.x dashboard droplet  
- **Final state:** crm.publicadjustermidwest.com becomes sole production system  
**Key benefit:** Users control their own migration pace. No forced cutover. If v3.0 has bugs, users can stay on v2.0 while fixes are applied.  
## 7. Database Schema  
The system utilizes a single PostgreSQL container (postgres:16-alpine) mounted as a Docker volume. The schema replaces all existing JSON file stores (user_profile_store.py, notes_store.py) and API responses.  
All tables in dependency order:  
### 7.1 Users & Auth  
CREATE TABLE users (  
    id SERIAL PRIMARY KEY,  
    email TEXT UNIQUE NOT NULL,  
    password_hash TEXT,  
    password_salt TEXT,  
    must_change_password BOOLEAN DEFAULT TRUE,  
    display_name TEXT,  
    first_name TEXT,  
    last_name TEXT,  
    is_admin BOOLEAN DEFAULT FALSE,  
    is_active BOOLEAN DEFAULT TRUE,  
    created_at TIMESTAMP DEFAULT NOW(),  
    last_login TIMESTAMP  
);  
CREATE TABLE sessions (  
    token TEXT PRIMARY KEY,  
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,  
    created_at TIMESTAMP DEFAULT NOW(),  
    expires_at TIMESTAMP NOT NULL,  
    ip_address TEXT  
);  
CREATE TABLE user_roles (  
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,  
    role TEXT NOT NULL DEFAULT 'user',    -- 'admin', 'user', 'bot'  
    PRIMARY KEY (user_id, role)  
);  
CREATE TABLE password_reset_tokens (  
    token TEXT PRIMARY KEY,  
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,  
    created_at TIMESTAMP DEFAULT NOW(),  
    expires_at TIMESTAMP NOT NULL,  
    used_at TIMESTAMP  
);  
**Auth implementation:**  
- server.py receives email + password on login  
- Verifies against users.password_hash using hashlib.pbkdf2_hmac (stdlib, zero dependencies)  
- Creates session token (secrets.token_urlsafe(32)), stores in sessions table, sets session cookie (HttpOnly, Secure in production)  
- All subsequent requests authenticated via session cookie → lookup in sessions table  
- must_change_password = TRUE forces password reset form on first login  
- Admin role grants access to admin modal  
- Password reset tokens expire after 1 hour  
### 7.2 Stages (Pipeline Configuration)  
CREATE TABLE stages (  
    id SERIAL PRIMARY KEY,  
    title TEXT NOT NULL,  
    color TEXT,  
    sort_order INTEGER DEFAULT 0,  
    stage_type SMALLINT DEFAULT 0,         -- 0=open, 1=closed-won, 2=closed-lost  
    probability INTEGER DEFAULT 0,  
    is_active BOOLEAN DEFAULT TRUE  
);  
### 7.3 System Settings  
CREATE TABLE system_settings (  
    key TEXT PRIMARY KEY,  
    value TEXT,  
    description TEXT,  
    updated_at TIMESTAMP DEFAULT NOW(),  
    updated_by INTEGER REFERENCES users(id)  
);  
-- Seed defaults:  
-- default_stage_id, default_probability, bid_required, currency_symbol,  
-- opportunity_prefix, mail_sync_enabled  
### 7.4 Contacts  
CREATE TABLE contacts (  
    id SERIAL PRIMARY KEY,  
    first_name TEXT,  
    last_name TEXT,  
    email TEXT,  
    phone TEXT,  
    mobile_phone TEXT,  
    company TEXT,  
    job_title TEXT,  
    address_street TEXT,  
    address_city TEXT,  
    address_state TEXT,  
    address_zip TEXT,  
    notes TEXT,  
    created_at TIMESTAMP DEFAULT NOW(),  
    created_by INTEGER REFERENCES users(id)  
);  
CREATE INDEX idx_contacts_name ON contacts(first_name, last_name);  
CREATE INDEX idx_contacts_email ON contacts(email);  
CREATE INDEX idx_contacts_company ON contacts(company);  
### 7.5 Custom Fields  
CREATE TABLE custom_field_definitions (  
    id SERIAL PRIMARY KEY,  
    field_key TEXT UNIQUE NOT NULL,  
    label TEXT NOT NULL,  
    field_type TEXT NOT NULL,              -- 'text','textarea','select','checkbox','date','number','currency'  
    is_required BOOLEAN DEFAULT FALSE,  
    default_value TEXT,  
    sort_order INTEGER DEFAULT 0,  
    show_on_create BOOLEAN DEFAULT TRUE,  
    show_on_edit BOOLEAN DEFAULT TRUE,  
    is_active BOOLEAN DEFAULT TRUE,  
    created_at TIMESTAMP DEFAULT NOW()  
);  
CREATE TABLE custom_field_options (  
    id SERIAL PRIMARY KEY,  
    field_id INTEGER REFERENCES custom_field_definitions(id) ON DELETE CASCADE,  
    option_value TEXT NOT NULL,  
    option_label TEXT NOT NULL,  
    sort_order INTEGER DEFAULT 0,  
    is_default BOOLEAN DEFAULT FALSE  
);  
CREATE TABLE opportunity_custom_field_values (  
    id SERIAL PRIMARY KEY,  
    opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE,  
    field_id INTEGER REFERENCES custom_field_definitions(id) ON DELETE CASCADE,  
    field_value TEXT,  
    UNIQUE(opportunity_id, field_id)  
);  
### 7.6 Opportunities (Projects)  
CREATE TABLE opportunities (  
    id SERIAL PRIMARY KEY,  
    title TEXT NOT NULL,  
    description TEXT,  
    stage_id INTEGER REFERENCES stages(id),  
    stage_type SMALLINT DEFAULT 0,  
    bid_value DECIMAL(12,2),  
    expected_close_date DATE,  
    probability INTEGER DEFAULT 0,  
    contact_id INTEGER REFERENCES contacts(id),  
    responsible_user_id INTEGER REFERENCES users(id),  
    is_private BOOLEAN DEFAULT FALSE,  
    created_at TIMESTAMP DEFAULT NOW(),  
    created_by INTEGER REFERENCES users(id),  
    updated_at TIMESTAMP DEFAULT NOW(),  
    updated_by INTEGER REFERENCES users(id)  
);  
CREATE INDEX idx_opportunities_stage ON opportunities(stage_id);  
CREATE INDEX idx_opportunities_stage_type ON opportunities(stage_type);  
CREATE INDEX idx_opportunities_contact ON opportunities(contact_id);  
CREATE INDEX idx_opportunities_responsible ON opportunities(responsible_user_id);  
### 7.7 Tags  
CREATE TABLE tag_definitions (  
    id SERIAL PRIMARY KEY,  
    title TEXT UNIQUE NOT NULL,  
    color TEXT,  
    created_at TIMESTAMP DEFAULT NOW()  
);  
CREATE TABLE opportunity_tags (  
    opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE,  
    tag_id INTEGER REFERENCES tag_definitions(id) ON DELETE CASCADE,  
    PRIMARY KEY (opportunity_id, tag_id)  
);  
CREATE INDEX idx_opportunity_tags_opp ON opportunity_tags(opportunity_id);  
CREATE INDEX idx_opportunity_tags_tag ON opportunity_tags(tag_id);  
### 7.8 History (Events, Notes, Calls, Meetings)  
CREATE TABLE history_categories (  
    id SERIAL PRIMARY KEY,  
    title TEXT UNIQUE NOT NULL,            -- 'Note', 'Call', 'Meeting', 'Email', etc.  
    display_color TEXT,  
    is_system BOOLEAN DEFAULT TRUE,  
    sort_order INTEGER DEFAULT 0  
);  
-- Seed values (insert during schema init):  
-- Note(1), Call(2), Meeting(3), Email(4), Customer Update(5),  
-- Text Message(6), Task(7), Comment(8)  
CREATE TABLE history_events (  
    id SERIAL PRIMARY KEY,  
    opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE,  
    category_id INTEGER REFERENCES history_categories(id),  
    title TEXT,  
    content TEXT,  
    created_by INTEGER REFERENCES users(id),  
    created_at TIMESTAMP DEFAULT NOW(),  
    backdated_created_at TIMESTAMP  
);  
CREATE INDEX idx_history_opp ON history_events(opportunity_id);  
CREATE INDEX idx_history_created ON history_events(created_at DESC);  
CREATE TABLE history_replies (  
    id SERIAL PRIMARY KEY,  
    event_id INTEGER REFERENCES history_events(id) ON DELETE CASCADE,  
    parent_reply_id INTEGER REFERENCES history_replies(id) ON DELETE CASCADE,  
    content TEXT NOT NULL,  
    created_by INTEGER REFERENCES users(id),  
    created_at TIMESTAMP DEFAULT NOW(),  
    is_deleted BOOLEAN DEFAULT FALSE,  
    deleted_by INTEGER REFERENCES users(id),  
    deleted_at TIMESTAMP,  
    source_notification_id INTEGER  
);  
CREATE INDEX idx_history_replies_event ON history_replies(event_id);  
CREATE INDEX idx_history_replies_parent ON history_replies(parent_reply_id);  
CREATE INDEX idx_history_replies_created ON history_replies(created_at DESC);  
CREATE INDEX idx_history_replies_source_notification ON history_replies(source_notification_id);  
CREATE TABLE history_attachments (  
    id SERIAL PRIMARY KEY,  
    event_id INTEGER REFERENCES history_events(id) ON DELETE CASCADE,  
    filename TEXT NOT NULL,  
    file_path TEXT NOT NULL,  
    file_size BIGINT,  
    mime_type TEXT,  
    uploaded_by INTEGER REFERENCES users(id),  
    uploaded_at TIMESTAMP DEFAULT NOW()  
);  
CREATE TABLE history_notify_users (  
    event_id INTEGER REFERENCES history_events(id) ON DELETE CASCADE,  
    user_id INTEGER REFERENCES users(id),  
    PRIMARY KEY (event_id, user_id)  
);  
### 7.9 Tasks  
CREATE TABLE tasks (  
    id SERIAL PRIMARY KEY,  
    title TEXT NOT NULL,  
    description TEXT,  
    opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,  
    responsible_user_id INTEGER REFERENCES users(id),  
    due_date TIMESTAMP,  
    priority INTEGER DEFAULT 0,  
    is_closed BOOLEAN DEFAULT FALSE,  
    closed_at TIMESTAMP,  
    closed_by INTEGER REFERENCES users(id),  
    created_at TIMESTAMP DEFAULT NOW(),  
    created_by INTEGER REFERENCES users(id)  
);  
CREATE INDEX idx_tasks_responsible ON tasks(responsible_user_id);  
CREATE INDEX idx_tasks_opportunity ON tasks(opportunity_id);  
CREATE INDEX idx_tasks_closed ON tasks(is_closed);  
### 7.10 Notifications (Internal Feed)  
CREATE TABLE notifications (  
    id SERIAL PRIMARY KEY,  
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,  
    type TEXT NOT NULL,                    -- 'note_tagged', 'task_assigned', 'reply_received', etc.  
    opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE,  
    actor_user_id INTEGER REFERENCES users(id),  
    message TEXT,  
    payload JSONB,  
    is_read BOOLEAN DEFAULT FALSE,  
    created_at TIMESTAMP DEFAULT NOW()  
);  
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);  
CREATE TABLE notification_preferences (  
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,  
    notification_type TEXT NOT NULL,  
    enabled BOOLEAN DEFAULT TRUE,  
    PRIMARY KEY (user_id, notification_type)  
);  
**Trigger to auto-create notifications when users are tagged in notes:**  
CREATE OR REPLACE FUNCTION create_tag_notifications()  
RETURNS TRIGGER AS $$  
BEGIN  
    IF NEW.category_id IN (SELECT id FROM history_categories WHERE title IN ('Note', 'Comment')) THEN  
        INSERT INTO notifications (user_id, type, opportunity_id, actor_user_id, message, payload, created_at)  
        SELECT  
            nu.user_id,  
            'note_tagged',  
            NEW.opportunity_id,  
            NEW.created_by,  
            (SELECT u.display_name || ' tagged you in a note on Project ' || p.title  
             FROM users u JOIN opportunities p ON p.id = NEW.opportunity_id  
             WHERE u.id = NEW.created_by),  
            jsonb_build_object('event_id', NEW.id, 'event_category', 'note'),  
            NOW()  
        FROM history_notify_users nu WHERE nu.event_id = NEW.id;  
    END IF;  
    RETURN NEW;  
END;  
$$ LANGUAGE plpgsql;  
CREATE TRIGGER trigger_create_tag_notifications  
    AFTER INSERT ON history_events  
    FOR EACH ROW EXECUTE FUNCTION create_tag_notifications();  
### 7.11 Photo Gallery  
CREATE TABLE project_photo_folders (  
    id SERIAL PRIMARY KEY,  
    opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE,  
    folder_type TEXT NOT NULL,              -- 'internal' or 'external'  
    label TEXT,                             -- "Adjuster Photos", "Inspection", etc.  
    external_url TEXT,                      -- for external: the shared link  
    external_provider TEXT,                 -- 'proton_drive', 'google_drive', 'onedrive', 'mega', 'dropbox', 'other'  
    created_by INTEGER REFERENCES users(id),  
    created_at TIMESTAMP DEFAULT NOW(),  
    UNIQUE(opportunity_id, external_url)  
);  
CREATE TABLE project_photos (  
    id SERIAL PRIMARY KEY,  
    opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE,  
    folder_id INTEGER REFERENCES project_photo_folders(id) ON DELETE SET NULL,  
    filename TEXT NOT NULL,  
    file_path TEXT NOT NULL,                -- relative path under data/photos/{project_id}/  
    file_size BIGINT,  
    mime_type TEXT,  
    exif_data JSONB,                        -- camera, date_taken (GPS STRIPPED)  
    thumbnail_path TEXT,  
    alt_description TEXT,  
    uploaded_by INTEGER REFERENCES users(id),  
    uploaded_at TIMESTAMP DEFAULT NOW(),  
    is_deleted BOOLEAN DEFAULT FALSE,  
    deleted_at TIMESTAMP  
);  
CREATE INDEX idx_project_photos_opp ON project_photos(opportunity_id);  
CREATE INDEX idx_project_photos_uploaded ON project_photos(uploaded_at DESC);  
CREATE TABLE photo_exif_cache (  
    image_path TEXT PRIMARY KEY,  
    camera_make TEXT,  
    camera_model TEXT,  
    lens TEXT,  
    focal_length TEXT,  
    aperture TEXT,  
    shutter_speed TEXT,  
    iso INTEGER,  
    date_taken TIMESTAMP,  
    gps_latitude DECIMAL(9,6),  
    gps_longitude DECIMAL(9,6),  
    processed_at TIMESTAMP DEFAULT NOW()  
);  
**150 MB per-project quota enforcement trigger:**  
CREATE OR REPLACE FUNCTION check_project_photo_quota()  
RETURNS TRIGGER AS $$  
DECLARE  
    current_size BIGINT;  
BEGIN  
    SELECT COALESCE(SUM(file_size), 0) INTO current_size  
    FROM project_photos  
    WHERE opportunity_id = NEW.opportunity_id AND is_deleted = FALSE;  
    IF current_size + NEW.file_size > 157286400 THEN  -- 150MB in bytes  
        RAISE EXCEPTION 'Project photo storage limit (150MB) exceeded. Current: % bytes, attempted add: % bytes',  
            current_size, NEW.file_size;  
    END IF;  
    RETURN NEW;  
END;  
$$ LANGUAGE plpgsql;  
CREATE TRIGGER enforce_photo_quota  
    BEFORE INSERT ON project_photos  
    FOR EACH ROW EXECUTE FUNCTION check_project_photo_quota();  
### 7.12 Mail (IMAP Sync Module — Phase 3+)  
CREATE TABLE mail_accounts (  
    id SERIAL PRIMARY KEY,  
    email TEXT UNIQUE NOT NULL,  
    imap_host TEXT NOT NULL,  
    imap_port INTEGER DEFAULT 993,  
    password_encrypted TEXT NOT NULL,  
    sync_enabled BOOLEAN DEFAULT TRUE,  
    sync_interval_seconds INTEGER DEFAULT 180,  
    last_sync TIMESTAMP,  
    last_uid TEXT,  
    owner_user_id INTEGER REFERENCES users(id)  
);  
CREATE TABLE mail_messages (  
    id SERIAL PRIMARY KEY,  
    account_id INTEGER REFERENCES mail_accounts(id) ON DELETE CASCADE,  
    imap_uid TEXT NOT NULL,  
    message_id TEXT,  
    in_reply_to TEXT,  
    from_addr TEXT,  
    to_addr TEXT,  
    cc_addr TEXT,  
    subject TEXT,  
    body_text TEXT,  
    body_html TEXT,  
    date_received TIMESTAMP,  
    is_read BOOLEAN DEFAULT FALSE,  
    is_flagged BOOLEAN DEFAULT FALSE,  
    is_archived BOOLEAN DEFAULT FALSE,  
    folder TEXT DEFAULT 'INBOX',  
    conversation_id TEXT,  
    created_at TIMESTAMP DEFAULT NOW(),  
    UNIQUE(account_id, imap_uid, folder)  
);  
CREATE INDEX idx_mail_account ON mail_messages(account_id);  
CREATE INDEX mail_date ON mail_messages(date_received DESC);  
CREATE INDEX idx_mail_read ON mail_messages(is_read);  
CREATE INDEX idx_mail_conversation ON mail_messages(conversation_id);  
CREATE TABLE mail_deal_links (  
    id SERIAL PRIMARY KEY,  
    message_id INTEGER REFERENCES mail_messages(id) ON DELETE CASCADE,  
    opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE,  
    linked_by_user_id INTEGER REFERENCES users(id),  
    linked_at TIMESTAMP DEFAULT NOW(),  
    UNIQUE(message_id, opportunity_id)  
);  
CREATE TABLE mail_flag_queue (  
    id SERIAL PRIMARY KEY,  
    message_id INTEGER REFERENCES mail_messages(id) ON DELETE CASCADE,  
    flag_name TEXT NOT NULL,  
    flag_value BOOLEAN NOT NULL,  
    queued_at TIMESTAMP DEFAULT NOW(),  
    pushed BOOLEAN DEFAULT FALSE  
);  
### 7.13 Sync Tracking (Bidirectional with OnlyOffice — transition only)  
CREATE TABLE sync_watermarks (  
    source TEXT PRIMARY KEY,                -- 'onlyoffice' or 'vanguard'  
    last_sync_timestamp TIMESTAMP,  
    last_processed_id INTEGER  
);  
CREATE TABLE opportunity_changes (  
    id SERIAL PRIMARY KEY,  
    opportunity_id INTEGER REFERENCES opportunities(id),  
    field_name TEXT NOT NULL,  
    old_value TEXT,  
    new_value TEXT,  
    changed_at TIMESTAMP DEFAULT NOW(),  
    changed_by INTEGER REFERENCES users(id),  
    pushed_to_onlyoffice BOOLEAN DEFAULT FALSE,  
    pushed_at TIMESTAMP  
);  
CREATE TABLE sync_errors (  
    id SERIAL PRIMARY KEY,  
    error_type TEXT NOT NULL,               -- 'push_failed', 'pull_failed', 'conflict'  
    source_table TEXT,  
    record_id INTEGER,  
    message TEXT,  
    resolved BOOLEAN DEFAULT FALSE,  
    created_at TIMESTAMP DEFAULT NOW()  
);  
### 7.14 Email Classifier (Future — tables created now, unused until merge)  
CREATE TABLE email_classifications (  
    id SERIAL PRIMARY KEY,  
    message_id INTEGER REFERENCES mail_messages(id),  
    classified_by TEXT DEFAULT 'classifier',  
    suggested_project_id INTEGER REFERENCES opportunities(id),  
    confidence_score DECIMAL(3,2),  
    action_type TEXT,  
    action_target JSONB,  
    status TEXT DEFAULT 'pending',  
    reviewed_by INTEGER REFERENCES users(id),  
    reviewed_at TIMESTAMP,  
    created_at TIMESTAMP DEFAULT NOW()  
);  
CREATE TABLE classifier_training_data (  
    id SERIAL PRIMARY KEY,  
    message_subject TEXT,  
    message_body_hash TEXT,  
    sender_email TEXT,  
    correct_classification TEXT,  
    correct_project_id INTEGER,  
    correct_action_type TEXT,  
    created_at TIMESTAMP DEFAULT NOW()  
);  
### 7.15 User Profiles (Migrated from JSON Immediately)  
CREATE TABLE user_profiles (  
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,  
    kanban_layout JSONB,                    -- column widths, collapsed states, tile order  
    tile_configs JSONB,                     -- per-tile configuration  
    theme_preference TEXT DEFAULT 'default',  
    notification_email_digest TEXT DEFAULT 'disabled',  -- future: 'daily', 'immediate', 'disabled'  
    created_at TIMESTAMP DEFAULT NOW(),  
    updated_at TIMESTAMP DEFAULT NOW()  
);  
## 8. Migration Script (migrate_from_onlyoffice.py)  
### 8.1 Overview  
A standalone Python script that authenticates to OnlyOffice CRM as an admin user, systematically pulls all data via the existing CRM API, and inserts it into PostgreSQL. Run once on the CRM droplet to populate the production database. Run on local dev first for testing.  
### 8.2 Prerequisites  
- PostgreSQL container running and schema initialized (init.sql executed)  
- OnlyOffice CRM accessible and admin credentials available  
- Python 3.10+ with psycopg2 (or psycopg[binary] for Python 3.12+) installed  
### 8.3 Execution Order (Dependency-Safe)  
Step 1: Users  
 ← GET /api/2.0/people/ (paginated, all active users)   → INSERT INTO users (email, display_name, first_name, last_name, is_admin)   → password_hash = NULL, must_change_password = TRUE for all   → Map: CRM user ID → new users.id (store in _migration_id_map)  Step 2: Stages   ← GET /api/2.0/crm/opportunity/stage   → INSERT INTO stages (title, color, sort_order, stage_type, probability)  Step 3: Tag Definitions   ← GET /api/2.0/crm/tag (all available tags)   → INSERT INTO tag_definitions (title, color)  Step 4: Custom Field Definitions   ← GET /api/2.0/crm/customfield/definition   → INSERT INTO custom_field_definitions (field_key, label, field_type, ...)   → For each select-type field: INSERT INTO custom_field_options (...)  Step 5: Contacts   ← GET /api/2.0/crm/contact (paginated, all contacts)   → INSERT INTO contacts (first_name, last_name, email, phone, company, ...)  Step 6: Opportunities (paginated, ALL stages including closed)   ← GET /api/2.0/crm/opportunity/filter?stageType=-1 (ALL stages)   → For each page of 50:     a. INSERT INTO opportunities (title, description, stage_id, bid_value, ...)     b. ← GET /api/2.0/crm/opportunity/{id}/tag → INSERT INTO opportunity_tags     c. ← GET /api/2.0/crm/opportunity/{id}/customfield → INSERT INTO opportunity_custom_field_values     d. ← GET /api/2.0/crm/history/filter?entityType=opportunity&entityID={id}        → For each event: INSERT INTO history_events (...)        → Map category title → history_categories.id (auto-create if missing)     e. ← GET /api/2.0/crm/opportunity/{id}/files        → For each file: download via filehandler, save to data/attachments/{opp_id}/        → INSERT INTO history_attachments (...)  Step 7: Tasks   ← GET /api/2.0/projects/task/?count=500 (open)   ← GET /api/2.0/projects/task/?count=500&closed=true (completed)   → INSERT INTO tasks (title, description, opportunity_id, responsible_user_id, due_date, ...)  Step 8: History Categories (verify/seed)   → Ensure all categories encountered during Step 6d exist in history_categories   → Insert any missing ones with is_system = TRUE  Step 9: User Profiles (migrate from JSON files)   → Read existing data/user-profiles/*.json   → Remap CRM user IDs to new users.id values   → INSERT INTO user_profiles (user_id, kanban_layout, tile_configs)  Step 10: Migration Report   → Print summary: X users, Y contacts, Z opportunities, N history events,     M tasks, K attachments (total size), P user profiles   → Print any warnings (missing references, failed downloads, unmapped fields)  
### 8.4 Rate Limiting  
- 10 requests/second max (configurable)  
- 1 second pause between opportunity sub-requests (tags, custom fields, history, files)  
- Retry on 429/503 with exponential backoff (1s, 2s, 4s, 8s, max 3 retries)  
- Progress logging per step (print every 50 items)  
### 8.5 Estimated Runtime  
| | | |  
|-|-|-|  
| **Data** | **Volume (est.)** | **Time** |   
| Users | ~10 | < 5s |   
| Stages | ~8-12 | < 5s |   
| Tags | ~20 | < 5s |   
| Custom field defs | ~15 | < 5s |   
| Contacts | ~50-200 | ~10s |   
| Opportunities (all stages) | ~500 | ~15s |   
| Tags per opp | 500 calls | ~3 min |   
| Custom fields per opp | 500 calls | ~3 min |   
| History per opp | 500 × 2 pages | ~5 min |   
| Attachments | ~200 files | ~10-30 min |   
| Tasks | ~100 | ~10s |   
| User profiles | ~10 | < 5s |   
| **Total** |   | **~20-40 min** |   
### 8.6 Output  
migration_report.txt:  
  Users imported:       8   Stages imported:     10   Tags imported:       18   Custom fields:       12 (4 text, 3 checkbox, 3 select, 2 date)   Contacts imported:  143   Opportunities:      487 (including 156 closed)   History events:    2,341   Attachments:        187 (total: 245.3 MB)   Tasks:               94   User profiles:        8    Warnings:     - Opportunity #1234: contact_id 5678 not found in contacts (orphaned reference)     - 3 attachment downloads failed (server timeout), see failed_downloads.log     - Custom field "Deductible Amount" had unexpected type 'money', mapped to 'currency'  
### 8.7 CSV Export Cross-Reference  
Even though the API pull is the primary method, a CSV export from OnlyOffice should be inspected as a cross-reference to validate the API pull. Compare deal counts and field coverage between the CSV and the migrated PostgreSQL data.  
## 9. Server.py Rewrite  
### 9.1 What Stays  
| | |  
|-|-|  
| **File/Module** | **Status** |   
| notes_store.py | Keeps working — notes tile content |   
| presence_store.py | Keeps working — presence/DM data (local, never depended on CRM for storage) |   
| event_log_store.py | Keeps working — event log (local) |   
| crm_bot_store.py | Keeps working — bot customer mappings (local JSON) |   
| telegram_bot.py | Modified — endpoints it calls change, but bot logic stays |   
| public/index.html | Mostly unchanged — minor auth form updates, new modals |   
| public/styles.css | Modified — tile grid, terminal tweaks, admin theme |   
### 9.2 What Gets Replaced  
Every /api/proxy/* handler in server.py that forward to OnlyOffice gets replaced with a direct PostgreSQL query.  
#### *Read Endpoints*  
| | |  
|-|-|  
| **Current (Proxy)** | **New (Direct DB)** |   
| GET /api/proxy/api/2.0/crm/opportunity/filter | GET /api/v2/projects?stage_type=X&... |   
| GET /api/proxy/api/2.0/crm/opportunity/{id} | GET /api/v2/projects/{id} |   
| GET /api/proxy/api/2.0/crm/opportunity/{id}/tag | GET /api/v2/projects/{id}/tags |   
| GET /api/proxy/api/2.0/crm/customfield/definition | GET /api/v2/custom-fields |   
| GET /api/proxy/api/2.0/crm/opportunity/{id}/customfield | GET /api/v2/projects/{id}/custom-fields |   
| GET /api/proxy/api/2.0/crm/history/filter | GET /api/v2/projects/{id}/history?page=X |   
| GET /api/proxy/api/2.0/crm/contact or /search | GET /api/v2/contacts?q=X |   
| GET /api/proxy/api/2.0/crm/opportunity/stage | GET /api/v2/stages |   
| GET /api/proxy/api/2.0/crm/tag | GET /api/v2/tags |   
| GET /api/proxy/api/2.0/projects/task/ | GET /api/v2/tasks?closed=X |   
| GET /api/proxy/api/2.0/people/@self | GET /api/v2/me (from session) |   
| GET /api/proxy/api/2.0/people/ | GET /api/v2/users |   
| Feed (CRM notification API) | GET /api/v2/notifications |   
#### *Write Endpoints*  
| | |  
|-|-|  
| **Current (Proxy)** | **New (Direct DB)** |   
| POST /api/proxy/api/2.0/crm/opportunity | POST /api/v2/projects |   
| PUT /api/proxy/api/2.0/crm/opportunity/{id} | PUT /api/v2/projects/{id} |   
| POST /api/proxy/api/2.0/crm/history | POST /api/v2/projects/{id}/history |   
| DELETE /api/proxy/api/2.0/crm/history/{id} | DELETE /api/v2/history/{id} |   
| POST /api/proxy/api/2.0/crm/opportunity/{id}/tag | POST /api/v2/projects/{id}/tags |   
| DELETE /api/proxy/api/2.0/crm/opportunity/{id}/tag | DELETE /api/v2/projects/{id}/tags/{tag_id} |   
| PUT /api/proxy/api/2.0/crm/opportunity/{id}/customfield | PUT /api/v2/projects/{id}/custom-fields |   
| File upload via UploadProgress.ashx | POST /api/v2/attachments (multipart upload) |   
#### *New Endpoints (No OnlyOffice Equivalent)*  
| | |  
|-|-|  
| **Endpoint** | **Purpose** |   
| POST /api/v2/auth/login | Email/password login, creates session |   
| POST /api/v2/auth/logout | Destroys session |   
| POST /api/v2/auth/reset-request | Generate reset token, send email |   
| POST /api/v2/auth/reset | Verify token, set new password |   
| GET /api/v2/projects/{id}/history/{event_id}/replies | Get threaded replies |   
| POST /api/v2/projects/{id}/history/{event_id}/replies | Post threaded reply |   
| DELETE /api/v2/history-replies/{id} | Delete a reply (soft delete) |   
| GET /api/v2/projects/{id}/photos | List photos for project |   
| POST /api/v2/projects/{id}/photos | Upload photo (with quota check) |   
| DELETE /api/v2/photos/{id} | Soft-delete photo |   
| GET /api/v2/projects/{id}/photo-folders | List external folder links |   
| POST /api/v2/projects/{id}/photo-folders | Add external folder link |   
| DELETE /api/v2/photo-folders/{id} | Remove external folder link |   
| POST /api/v2/admin/users | Create user (admin only) |   
| PUT /api/v2/admin/users/{id} | Edit user (admin only) |   
| POST /api/v2/admin/stages | Create stage (admin only) |   
| PUT /api/v2/admin/stages/{id} | Edit stage (admin only) |   
| POST /api/v2/admin/custom-fields | Create custom field def (admin only) |   
| PUT /api/v2/admin/custom-fields/{id} | Edit custom field def (admin only) |   
| POST /api/v2/admin/contacts | Create contact |   
| PUT /api/v2/admin/contacts/{id} | Edit contact |   
| POST /api/v2/admin/tags | Create tag (admin only) |   
| PUT /api/v2/admin/tags/{id} | Edit/merge tag (admin only) |   
#### *Endpoints Being Deleted*  
| | |  
|-|-|  
| **Endpoint** | **Reason** |   
| All /api/proxy/* routes | Replaced by direct DB queries |   
| Proxy cache (_proxy_cache) | Local DB is fast enough |   
| X-OnlyOffice-Portal header handling | Single-tenant, not needed |   
| CRM token management / refresh | Own auth system |   
| Bot CRM auth (BOT_CRM_EMAIL / BOT_CRM_PASSWORD) | Bot reads from DB directly |   
### 9.3 New db.py Module  
# db.py — PostgreSQL connection layer  
import psycopg2  
from psycopg2 import pool  
import os  
_pool = None  
def init_db():  
    """Initialize connection pool. Call once at server startup."""  
    global _pool  
    _pool = psycopg2.pool.SimpleConnectionPool(  
        minconn=2,  
        maxconn=10,  
        host=os.getenv('DB_HOST', 'db'),  
        port=os.getenv('DB_PORT', '5432'),  
        dbname=os.getenv('DB_NAME', 'vanguard'),  
        user=os.getenv('DB_USER', 'vanguard'),  
        password=os.getenv('DB_PASSWORD', '')  
    )  
def get_conn():  
    """Get a connection from the pool. Use as context manager."""  
    return _pool.getconn()  
def put_conn(conn):  
    """Return a connection to the pool."""  
    _pool.putconn(conn)  
def query(sql, params=None, fetch='all'):  
    """Execute a query and return results. Handles connection lifecycle."""  
    conn = get_conn()  
    try:  
        cur = conn.cursor()  
        cur.execute(sql, params or ())  
        if fetch == 'all':  
            return cur.fetchall()  
        elif fetch == 'one':  
            return cur.fetchone()  
        elif fetch == 'none':  
            conn.commit()  
            return None  
    except Exception:  
        conn.rollback()  
        raise  
    finally:  
        cur.close()  
        put_conn(conn)  
### 9.4 New auth.py Module  
# auth.py — Authentication, sessions, password reset  
import hashlib  
import secrets  
import time  
SESSION_DURATION = 86400 * 7  # 7 days  
RESET_DURATION = 3600         # 1 hour  
def hash_password(password: str, salt: bytes = None) -> tuple:  
    """PBKDF2 password hashing. Returns (hash_hex, salt_hex)."""  
    if salt is None:  
        salt = secrets.token_bytes(16)  
    dk = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100_000)  
    return dk.hex(), salt.hex()  
def verify_password(password: str, stored_hash: str, salt_hex: str) -> bool:  
    salt = bytes.fromhex(salt_hex)  
    dk = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100_000)  
    return secrets.compare_digest(dk.hex(), stored_hash)  
def create_session(user_id: int) -> str:  
    token = secrets.token_urlsafe(32)  
    expires = int(time.time()) + SESSION_DURATION  
    query(  
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (%s, %s, to_timestamp(%s))",  
        (token, user_id, expires),  
        fetch='none'  
    )  
    return token  
def get_session_user(token: str) -> dict | None:  
    row = query(  
        """SELECT u.id, u.email, u.display_name, u.is_admin, u.must_change_password  
           FROM sessions s JOIN users u ON s.user_id = u.id  
           WHERE s.token = %s AND s.expires_at > NOW() AND u.is_active = TRUE""",  
        (token,), fetch='one'  
    )  
    if not row:  
        return None  
    return {'id': row[0], 'email': row[1], 'display_name': row[2],  
            'is_admin': row[3], 'must_change_password': row[4]}  
def destroy_session(token: str):  
    query("DELETE FROM sessions WHERE token = %s", (token,), fetch='none')  
def create_reset_token(user_id: int) -> str:  
    token = secrets.token_urlsafe(32)  
    expires = int(time.time()) + RESET_DURATION  
    query(  
        "INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (%s, %s, to_timestamp(%s))",  
        (token, user_id, expires),  
        fetch='none'  
    )  
    return token  
def verify_reset_token(token: str) -> int | None:  
    row = query(  
        """SELECT user_id FROM password_reset_tokens  
           WHERE token = %s AND expires_at > NOW() AND used_at IS NULL""",  
        (token,), fetch='one'  
    )  
    return row[0] if row else None  
def consume_reset_token(token: str):  
    query("UPDATE password_reset_tokens SET used_at = NOW() WHERE token = %s",  
          (token,), fetch='none')  
## 10. Frontend Changes (public/app.js)  
### 10.1 API Path Swaps  
Every api('/api/proxy/api/2.0/crm/...') call gets rewritten to api('/api/v2/projects/...'). Response shapes from new endpoints match what app.js currently expects — server.py formats DB query results identically to OnlyOffice API responses.  
// BEFORE:  
const data = await api('/api/proxy/api/2.0/crm/opportunity/filter?stageType=0&...');  
// AFTER:  
const data = await api('/api/v2/projects?stage_type=0&...');  
// Response shape is identical — server.py formats it the same way  
### 10.2 Code Deletion (CRM Workarounds)  
| | | |  
|-|-|-|  
| **Code** | **Lines (est.)** | **Reason** |   
| Mutation queue (processMutationQueue, withCrmQueueOnTransient, localStorage queue logic) | ~200 | No external dependency to fail |   
| Crash banner (showCrmCrashNotification, onCRMSuccess, banner element) | ~100 | No 5xx possible from local DB |   
| bustCache() helper and all force=true plumbing | ~50 | No proxy cache |   
| parseCrmDateOnly() timezone workaround | ~20 | Control date format at storage |   
| All oo_token cookie reading / forwarding | ~80 | Own auth system |   
| **Total estimated deletion** | **~450 lines** |   |   
### 10.3 New Frontend Components  
#### *Threaded Replies UI*  
- Each history event shows a "reply" button (speech bubble icon)  
- Clicking opens inline reply composer below the event  
- Replies displayed indented beneath parent event (like Reddit/GitHub comments)  
- Max 3 levels deep before collapsing (level 4+ flattened with "replying to [user]" prefix)  
- "Deleted" replies show "Comment deleted by [user] at [date]" stub  
- Sort order: chronological (oldest first, newest at bottom)  
#### *Notification Drawer*  
- Click notification in Feed tile → drawer slides from right  
- Drawer shows original note content + existing threaded replies + inline reply composer  
- Submit reply → posts as history_reply linked to original history_event  
- Original note creator gets new notification: "[User] replied to your note on Project X"  
- Drawer auto-refreshes with new reply  
#### *Photo Gallery Tab*  
- New tab in Project Preview modal (Details / Documents / History / **Photos**)  
- Internal photos as thumbnail grid (with 150MB usage bar showing used / 150 MB)  
- External folders as cards with provider icon + "Open" link button  
- Upload button (disabled when quota full)  
- "Add External Folder" button (paste URL, select provider dropdown)  
- Full-screen lightbox viewer (click thumbnail → zoom, pan, navigate prev/next)  
- EXIF sidebar (camera make/model, date taken, lens, aperture, ISO, focal length — NO GPS)  
- Soft delete (move to trash, admin can recover)  
## 11. Dashboard Tile Layout Refactoring  
### Problem  
"Tiles don't move smoothly and do unpredictable things." Reference: odysseus.dev (https://github.com/odysseus-dev/odysseus.as) for tiling behavior + terminal style theme.  
### Solution: CSS Grid + FLIP Animations + Subtle Terminal Theme  
#### *Grid System*  
.dashboard-tiles {  
    display: grid;  
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));  
    gap: 1rem;  
    padding: 1rem;  
    background: var(--bg-dark, #1a1a1a);  
    transition: grid-template-columns 0.3s ease;  
}  
.tile-container {  
    background: var(--surface-dark, #2a2a2a);  
    border: 1px solid var(--border-light, #333);  
    border-radius: 6px;  
    overflow: hidden;  
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;  
    will-change: transform;  
    grid-column: span 1;  
}  
.tile-half { grid-column: span 2; }  
.tile-full { grid-column: span 3; }  
.tile-container:hover {  
    border-color: var(--accent-primary, #6d4aff);  
    box-shadow: 0 4px 16px rgba(109, 75, 255, 0.15);  
}  
#### *Responsive Breakpoints*  
@media (max-width: 600px) {  
    .dashboard-tiles { grid-template-columns: 1fr; }  
    .tile-container { grid-column: span 1 !important; }  
}  
@media (min-width: 601px) and (max-width: 1024px) {  
    .dashboard-tiles { grid-template-columns: repeat(2, 1fr); }  
}  
@media (min-width: 1025px) {  
    .dashboard-tiles { grid-template-columns: repeat(4, 1fr); }  
    .tile-quarter { grid-column: span 1; }  
    .tile-half { grid-column: span 2; }  
    .tile-three { grid-column: span 3; }  
    .tile-full { grid-column: span 4; }  
}  
#### *Collapse/Expand Animations*  
.tile-body {  
    max-height: 800px;  
    overflow-y: auto;  
    transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);  
}  
.tile-body-collapsed {  
    max-height: 0;  
    opacity: 0;  
    pointer-events: none;  
}  
#### *Drag-and-Drop (Smooth Animation)*  
import Sortable from 'sortablejs';  
const sortable = Sortable.create(document.querySelector('.dashboard-tiles'), {  
    animation: 200,  
    ghostClass: 'tile-dragging',  
    chosenClass: 'tile-chosen',  
    dragClass: 'tile-drag-active',  
    onEnd: function(evt) {  
        persistTileOrder();  
    }  
});  
Uses FLIP (First, Last, Invert, Play) technique for smooth reorder. GPU-accelerated CSS transforms.  
#### *Subtle Terminal Theme (Scrolling Data Panes Only)*  
.history-scroll-pane, .event-log-scroll-pane {  
    font-family: 'DM Mono', 'Consolas', monospace;  
    background: #0d0d0d;  
    border: 1px solid #2a2a2a;  
    border-radius: 4px;  
    padding: 0.75rem;  
    line-height: 1.5;  
    color: #d0d0d0;  
}  
.history-scroll-pane .entry {  
    border-left: 2px solid #333;  
    padding-left: 0.75rem;  
    margin-bottom: 0.5rem;  
}  
.history-scroll-pane .entry.reply {  
    border-left-color: #666;  
    margin-left: 1rem;  
}  
#### *Theme Scope*  
**Applied to:**  
- Scrolling data panes (history notes, event log, feed) — monospace font, dark background, border-left entry markers  
- Admin modal — aggressive terminal theme (see Section 12)  
**NOT applied to:**  
- Kanban cards, project modals, forms (keep existing styling)  
- Tile chrome (toolbar, buttons)  
- Main dashboard background (existing theme)  
## 12. Unified Admin Modal  
### Location & Trigger  
- Button near "Sign Out" in header (same position as current bot-customers button: right: 9.5rem)  
- Icon: tabler.io tower (icon-tabler-tower)  
- Visible only when user.is_admin = TRUE  
- Opens modal overlay (backdrop, centered, ESC/close/dismiss)  
### Modal Structure  
<div id="admin-modal" class="modal">  
    <div class="modal-backdrop"></div>  
    <div class="modal-card-admin-panel">  
        <!-- Left sidebar with tabs -->  
        <div class="admin-sidebar">  
            <button class="admin-tab active" data-tab="projects">Projects</button>  
            <button class="admin-tab" data-tab="users">Users</button>  
            <button class="admin-tab" data-tab="stages">Stages</button>  
            <button class="admin-tab" data-tab="custom-fields">Custom Fields</button>  
            <button class="admin-tab" data-tab="contacts">Contacts</button>  
            <button class="admin-tab" data-tab="tags">Tags</button>  
            <button class="admin-tab" data-tab="photos">Photo Gallery Config</button>  
            <button class="admin-tab" data-tab="sync">Sync Status</button>  
            <button class="admin-tab" data-tab="mail">Mail Accounts</button>  
            <button class="admin-tab" data-tab="settings">System Settings</button>  
            <button class="admin-tab" data-tab="event-log">Event Log</button>  
            <button class="admin-tab" data-tab="bot">Customer Bot</button>  
            <div class="admin-spacer"></div>  
            <button class="admin-tab-danger" data-action="sign-out">Sign Out</button>  
        </div>  
        	        <!-- Right content area -->  
        <div class="admin-content">  
            <div class="admin-tab-content" id="tab-projects"><!-- Projects manager --></div>  
            <div class="admin-tab-content" id="tab-users" style="display:none"><!-- Users manager --></div>  
            <div class="admin-tab-content" id="tab-stages" style="display:none"><!-- Stages config --></div>  
            <div class="admin-tab-content" id="tab-custom-fields" style="display:none"><!-- Fields --></div>  
            <div class="admin-tab-content" id="tab-contacts" style="display:none"><!-- Contacts --></div>  
            <div class="admin-tab-content" id="tab-tags" style="display:none"><!-- Tags --></div>  
            <div class="admin-tab-content" id="tab-photos" style="display:none"><!-- Photo config --></div>  
            <div class="admin-tab-content" id="tab-sync" style="display:none"><!-- Sync --></div>  
            <div class="admin-tab-content" id="tab-mail" style="display:none"><!-- Mail --></div>  
            <div class="admin-tab-content" id="tab-settings" style="display:none"><!-- Settings --></div>  
            <div class="admin-tab-content" id="tab-event-log" style="display:none"><!-- Event log --></div>  
            <div class="admin-tab-content" id="tab-bot" style="display:none"><!-- Bot customers --></div>  
        </div>  
    </div>  
</div>  
### Tab Descriptions  
| | | |  
|-|-|-|  
| **Tab** | **Content** | **Phase** |   
| **Projects** | List all projects, search, add/edit/delete | 1 |   
| **Users** | User manager (create, edit roles, reset passwords, force password reset) | 1 |   
| **Stages** | Pipeline configuration (add, reorder, color, set closed states) | 1 |   
| **Custom Fields** | Field definitions + dropdown options management | 1 |   
| **Contacts** | Contact manager (CRUD with search) | 1 |   
| **Tags** | Tag manager (rename, merge, delete, color) | 2 |   
| **Photo Gallery Config** | Per-project storage limits, external provider settings | 2 |   
| **Sync Status** | Bidirectional sync monitor, watermarks, errors, manual force-sync | 3 |   
| **Mail Accounts** | IMAP account configuration (Phase 3+) | 3 |   
| **System Settings** | Defaults, currency, notification prefs | 2 |   
| **Event Log** | Existing event log (reused, no changes) | 1 |   
| **Customer Bot** | Existing bot-customers modal (reused, no changes) | 1 |   
### Admin Terminal Theme (Aggressive)  
.admin-modal {  
    background: #0a0a0a;  
    border: 1px solid #333;  
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);  
}  
.admin-sidebar {  
    background: linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%);  
    border-right: 1px solid #333;  
}  
.admin-tab {  
    color: #e0e0e0;  
    border-left: 3px solid transparent;  
    padding: 0.75rem 1rem;  
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;  
    font-family: 'DM Mono', 'Consolas', monospace;  
}  
.admin-tab:hover {  
    background: #1a1a1a;  
    color: #00ff88;  
}  
.admin-tab.active {  
    background: #1a1a1a;  
    border-left-color: #00ff88;  
    color: #00ff88;  
    text-shadow: 0 0 8px rgba(0, 255, 136, 0.4);  
}  
.admin-tab-danger {  
    color: #ff4444;  
    margin-top: auto;  
    border-top: 1px solid #333;  
    font-family: 'DM Mono', 'Consolas', monospace;  
}  
.admin-content {  
    background: #0f0f0f;  
}  
## 13. Threaded Replies in History Notes  
### Database  
See Section 7.8 — history_replies table with self-referencing parent_reply_id for nesting.  
### Behavior  
- Each history event shows a "reply" button (speech bubble icon)  
- Clicking opens inline reply composer below the event  
- Replies displayed indented beneath parent event (like Reddit/GitHub comments)  
- **Max 3 levels deep** before collapsing. Level 4+ flattened with "replying to [user]" prefix  
- "Deleted" replies show "Comment deleted by [user] at [date]" stub (does not delete children)  
- Sort order: chronological (oldest first, newest at bottom)  
- Replies can be created from two places:  
  - **Project history tab:** Click reply icon on any note → inline composer  
  - **Notification drawer:** Click notification → drawer slides from right → reply inline  
### API Endpoints  
GET    /api/v2/projects/{id}/history/{event_id}/replies    → list all replies for event  
POST   /api/v2/projects/{id}/history/{event_id}/replies    → create reply (parent_reply_id optional) DELETE /api/v2/history-replies/{id}                        → soft delete reply  
### Backward Compatibility Note  
Threaded replies are NOT backward compatible with OnlyOffice CRM. Replies created in v3.0 will not sync to OnlyOffice during the transition period. This is acceptable — the transition period is temporary and OnlyOffice will be archived.  
## 14. Photo Gallery per Project  
### Storage Model: Hybrid (needs more suggestions)  
| | | |  
|-|-|-|  
| **Mode** | **How it works** | **Limit** |   
| **Internal (self-hosted)** | Uploaded directly to droplet filesystem under data/photos/{project_id}/ | 150 MB per project, hard cap (database trigger enforced) |   
| **External (linked)** | URL to shared folder (Proton Drive, Google Drive, OneDrive, MEGA, Dropbox) | Unlimited — it's just a link |   
### Features  
- Upload photos to project (drag-and-drop or file picker)  
- Grid gallery view (thumbnail tiles)  
- Full-screen lightbox viewer (zoom, pan, navigate prev/next)  
- EXIF sidebar (metadata display — camera, date, lens, aperture, ISO, focal length — **NO GPS**)  
- External folder links with provider icon  
- 150 MB usage bar for internal photos  
- Delete (soft delete → admin can recover)  
- Simple — no AI features from Immich, just standard photo gallery based on existing CRM standards  
- Future: Integration with standard cloud drives to display photos in a gallery from external source (like Mega, Proton Drive, Dropbox, Google Drive etc) need to explore options. This is to lessen droplet server storage requirements.   
### Thumbnail Generation  
Automatic on upload using Python's Pillow library. Stored as data/photos/{project_id}/thumbnails/{filename}_thumb.jpg at 300×300 max.  
### EXIF Extraction  
Extract on upload using exifread or Pillow. **Strip GPS coordinates** from stored exif_data JSONB. Keep camera make/model, date taken, lens, aperture, ISO, focal length.  
### Database  
See Section 7.11 — project_photo_folders, project_photos, photo_exif_cache tables with 150 MB quota trigger.  
### UI Location  
New tab in Project Preview modal: Details / Documents / History / **Photos**  
## 15. Notifications & Feed  
### Delivery Channels  
| | | |  
|-|-|-|  
| **Channel** | **When** | **How** |   
| **Dashboard Feed tile** | Real-time (poll on refresh) | notifications table → feed tile |   
| **Telegram bot** | When user has linked Telegram account | Bot sends message via existing infrastructure. BUT we need to consider combining this with the telegram customer bot for employees so they only need one bot for notifications, lookup and note posting. |   
**No email notifications in MVP.** SMTP is for password reset only to start. Email notification digests are a future enhancement.  
### Feed Tile (User Notifications Only)  
Feed tile shows **only** events where current user is in history_notify_users OR where they were the actor_user_id. Not a global activity feed.  
### Notification Types  
| | |  
|-|-|  
| **Type** | **Trigger** |   
| note_tagged | User is in history_notify_users for a new note event |   
| task_assigned | Task's responsible_user_id matches user |   
| reply_received | Reply posted on an event the user created or was tagged in |   
### Notification Trigger (PostgreSQL)  
See Section 7.10 — create_tag_notifications() trigger fires on history_events INSERT, generates notifications for all tagged users.  
### Telegram Notification Dispatch  
- Reuse existing crm_bot_store.py mappings (employees already linked via invite codes)  
- When notification_engine.py creates a notification, it checks if the target user has a linked Telegram chat ID  
- If yes, sends a Telegram message: "You were tagged in a note on Project [Title] by [User]"  
- Message includes a link to view and reply in the CRM (this should produce a quick loading standalone page displaying the project/deal by itself, with editing options and a link somewhere prominently to take the user back to the dashboard view). The assumption is that most notifications will be clicked on mobile and the project view needs to be mobile friendly (dashboard takes a while to load).   
### Notification Drawer (Inline Reply)  
1. Feed tile shows notification: "You were tagged in a note by Ken on Project X"  
2. Click notification → notification detail drawer slides from right  
3. Drawer shows:  
  - Original note content  
  - Threaded replies (if any)  
  - Inline reply composer at bottom  
4. Submit reply → posts as history_reply linked to original history_event, with source_notification_id set  
5. Drawer auto-refreshes with new reply  
6. Creator of original note gets new notification: "[User] replied to your note on Project X"  
## 16. SMTP Client  
### Purpose  
- **MVP:** Password reset / recovery emails only  
- **Future:** Task assignments, note notifications (like OnlyOffice currently does)  
### Implementation (smtp_client.py)  
import smtplib  
from email.mime.text import MIMEText  
from email.mime.multipart import MIMEMultipart  
import os  
SMTP_HOST = os.getenv('SMTP_HOST', '')  
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))  
SMTP_USER = os.getenv('SMTP_USER', '')  
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')  
SMTP_FROM_NAME = os.getenv('SMTP_FROM_NAME', 'Vanguard CRM')  
SMTP_USE_TLS = os.getenv('SMTP_USE_TLS', 'true').lower() == 'true'  
def send_email(to_addr: str, subject: str, html_body: str, text_body: str = None):  
    """Send email via external SMTP relay."""  
    msg = MIMEMultipart('alternative')  
    msg['From'] = f'{SMTP_FROM_NAME} <{SMTP_USER}>'  
    msg['To'] = to_addr  
    msg['Subject'] = subject  
     if text_body:  
        msg.attach(MIMEText(text_body, 'plain'))  
    msg.attach(MIMEText(html_body, 'html'))  
     with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:  
        if SMTP_USE_TLS:  
            server.starttls()  
        server.login(SMTP_USER, SMTP_PASSWORD)  
        server.send_message(msg)  
### Password Reset Flow  
1. User clicks "Forgot Password" on login screen  
2. Enters email address  
3. server.py generates reset token (secrets.token_urlsafe(32)), stores with 1-hour expiry in password_reset_tokens  
4. SMTP sends email with link: https://crm.publicadjustermidwest.com/reset?token=...  
5. User clicks link, enters new password  
6. Token verified, password updated, token consumed (marked used_at)  
7. All sessions for that user destroyed (force re-login everywhere)  
## 17. Email Classifier Module (Deferred)  
### Decision: Merge After v3 Stable  
**Do not integrate email classifier into v3.0 MVP.** Keep in separate branch (email-classifier-feature) for later merge after core system is stable post-deployment.  
### Reasoning  
- Email classifier is complex (ML training, confidence thresholds, feedback loops)  
- Better to stabilize core CRM first (projects, photos, threads)  
- Email scanner already exists as separate Docker container (dry-run mode)  
- Can connect it to v3.0 after launch without disrupting other work  
### Later Integration Steps  
1. Merge email-classifier-feature into v3-crm-independence branch  
2. Connect classifier output to email_classifications table  
3. Build "Classifier Queue" admin tab in unified admin modal  
4. Enable auto-actions when confidence > 90%  
5. Training loop: user corrections improve model weights  
6. Tune based on real-world data from v3 deployment  
### Database Tables (Created Now, Unused Until Merge)  
See Section 7.14 — email_classifications and classifier_training_data tables.  
## 18. Bidirectional Sync (Transition Period)  
### Sync Direction A: OnlyOffice → v3 (Background Pull)  
- Hourly job that pulls changed items from OnlyOffice since last watermark  
- Upserts into v3 PostgreSQL  
- Updates: opportunities, contacts, tags, custom fields, history events  
- Does NOT sync threaded replies (v3-only feature, not backward compatible)  
### Sync Direction B: v3 → OnlyOffice (Background Push)  
- Track mutations in v3 via opportunity_changes table  
- Push changes to OnlyOffice via its API hourly  
- Only pushes what changed since last sync  
- Does NOT push threaded replies or photo gallery data (v3-only features)  
### Conflict Resolution  
- **Timestamp wins** — whichever has newer updated_at  
- **Manual override** — if sync fails, log to sync_errors table for admin review in Admin Modal → Sync Status tab  
### Implementation (sync_worker.py)  
Runs as a systemd service on the CRM droplet host. Configured via environment variables. Runs hourly. Logs to stderr (captured by journald).  
### Sync Monitor (Admin Modal → Sync Status Tab)  
- Shows last sync time (both directions)  
- Shows pending changes count  
- Shows error list with resolve/dismiss options  
- Manual "Force Sync Now" button  
- Watermark display  
### Lifecycle  
- Active during Phase 4 (beta deployment) and Phase 5 (transition)  
- Removed in Phase 5 final step when OnlyOffice is archived  
- ONLYOFFICE_PORTAL_URL and sync credentials removed from .env at that time  
## 19. Telegram Bot Changes  
### Current State  
The bot (telegram_bot.py) runs as a systemd service, calls server.py endpoints (/api/bot/deals, /api/bot/verify, etc.), which in turn call the OnlyOffice CRM API. Bot auth to the dashboard uses TELEGRAM_BOT_TOKEN as a bearer token.  
### Changes  
The bot's interaction with server.py doesn't change structurally — it still calls the same dashboard endpoints. What changes is that server.py now serves data from PostgreSQL instead of proxying to CRM. The bot sees the same response shapes.  
Specific changes:  
- BOT_CRM_EMAIL / BOT_CRM_PASSWORD env vars **no longer needed** (bot was using these to authenticate to OnlyOffice CRM)  
- crm_bot_store.py **continues working** (JSON file storage for customer mappings)  
- The /api/bot/deals endpoint in server.py changes from "authenticate to CRM, fetch deals, return" to "query PostgreSQL, return"  
- History events now come from history_events table directly — no more _fetch_full_mail_body(), _extract_mail_message_id(), _sanitize_html() workarounds (ISSUE-010 solved by design)  
- Add notification dispatch: when notification_engine.py creates a notification, bot sends Telegram message if user is linked  
### Files Changed  
| | |  
|-|-|  
| **File** | **Change** |   
| telegram_bot.py | Remove CRM workaround functions (_sanitize_html, _html_to_text, _extract_forward_info, _clean_reply_attribution, _truncate_html, _strip_html_tags, _format_mail_event). Add notification dispatch. |   
| server.py | /api/bot/deals endpoint queries PostgreSQL instead of CRM API. Remove bot CRM auth token caching. |   
| .env / config.example.env | Remove BOT_CRM_EMAIL, BOT_CRM_PASSWORD. Add DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD. |   
### Estimated Code Deletion  
~250 lines of CRM workaround functions removed from telegram_bot.py.  
## 20. Docker Compose Changes  
### Updated docker-compose.yml  
services:  
  dashboard:  
    container_name: vanguard-crm-v3  
    build: .  
    ports:  
      - "127.0.0.1:8766:8766"  
    depends_on:  
      db:  
        condition: service_healthy  
    environment:  
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}  
      - DB_HOST=db  
      - DB_PORT=5432  
      - DB_NAME=${DB_NAME}  
      - DB_USER=${DB_USER}  
      - DB_PASSWORD=${DB_PASSWORD}  
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}  
      - COOKIE_SECRET=${COOKIE_SECRET}  
      - SMTP_HOST=${SMTP_HOST}  
      - SMTP_PORT=${SMTP_PORT}  
      - SMTP_USER=${SMTP_USER}  
      - SMTP_PASSWORD=${SMTP_PASSWORD}  
      - SMTP_FROM_NAME=${SMTP_FROM_NAME}  
      - SMTP_USE_TLS=${SMTP_USE_TLS}  
      - PHOTO_STORAGE_PATH=/app/data/photos  
      - PHOTO_MAX_PROJECT_SIZE_MB=150  
      - SYNC_INTERVAL_SECONDS=3600  
      - ONLYOFFICE_PORTAL_URL=${ONLYOFFICE_PORTAL_URL}  
      - SYNC_BOT_EMAIL=${SYNC_BOT_EMAIL}  
      - SYNC_BOT_PASSWORD=${SYNC_BOT_PASSWORD}  
      - PORT=8766  
    volumes:  
      - dashboard-data:/app/data  
    networks:  
      - vanguard-internal  
  db:  
    image: postgres:16-alpine  
    container_name: vanguard-db  
    restart: always  
    healthcheck:  
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]  
      interval: 10s  
      timeout: 5s  
      retries: 5  
    environment:  
      POSTGRES_DB: ${DB_NAME}  
      POSTGRES_USER: ${DB_USER}  
      POSTGRES_PASSWORD: ${DB_PASSWORD}  
    volumes:  
      - db-data:/var/lib/postgresql/data  
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro  
    networks:  
      - vanguard-internal  
    # No ports exposed — only accessible within Docker network  
volumes:  
  dashboard-data:  
  db-data:  
networks:  
  vanguard-internal:  
    driver: bridge  
### New init.sql  
Contains all CREATE TABLE statements from Section 7, plus seed data:  
- history_categories (8 rows)  
- system_settings (6 default rows)  
- Default stage (one "New Lead" stage so the system is usable on first boot)  
### Dockerfile Changes  
# ADD: psycopg2 for PostgreSQL  
RUN pip install psycopg2-binary  
# ADD: Pillow for thumbnail generation  
RUN pip install Pillow  
# ADD: exifread for EXIF extraction  
RUN pip install ExifRead  
# KEEP: existing COPY lines for all .py modules  
# ADD: COPY init.sql  
# ADD: COPY migrate_from_onlyoffice.py  
# ADD: COPY db.py  
# ADD: COPY auth.py  
# ADD: COPY smtp_client.py  
# ADD: COPY photo_manager.py  
# ADD: COPY notification_engine.py  
# ADD: COPY admin_panel.py  
# ADD: COPY sync_worker.py  
## 21. Implementation Phases  
### Phase 1: Foundation + Core CRM (Week 1-3)  
**Goal:** Local dev can authenticate, CRUD projects, threaded replies work.  
**Deliverables:**  
1. Create v3-crm-independence branch  
2. init.sql — full schema (all 34 tables) + seed data + triggers + quota enforcement  
3. db.py — PostgreSQL connection pool + query helpers  
4. auth.py — password hashing (PBKDF2), session management, reset tokens  
5. smtp_client.py — SMTP relay for password reset emails  
6. docker-compose.yml updated with PostgreSQL container  
7. migrate_from_onlyoffice.py — one-time API pull (includes closed deals, user profiles from JSON)  
8. All read endpoints rewritten from proxy to direct DB  
9. All write endpoints rewritten (projects, stages, tags, custom fields, contacts, history, tasks, attachments)  
10. app.js API path swaps (/api/v2/projects/...)  
11. User profiles migrated from JSON to PostgreSQL with ID remapping  
12. Threaded replies: database tables, API endpoints, UI in history tab  
13. Remove dead code: mutation queue, crash banner, proxy cache  
## 22. Extra changes  
1. Search modal needs a dramatic expansion of functionality. It should be a place to quickly see all deals and be able to apply different filters to filter results dynamically. This would he in the primary tab by default. Batch select to change tags, stages, add to tabs or bookmarks etc.   
2. Deal/project tiles should not have a preview deal button anymore, because clicking on the title of the project in the tile should bring up the preview deal modal instead.   
3. Things to keep in mind: testing the telegram bot may conflict with the current running on on the dashboard droplet.   
4. Calendar tile offering webdav syncing per user.   
5. Users will need a profile/account modal to put in basic personal details, name address phone number, display name. Password reset. Profile picture change (profile pictures will probably only be viewable when looking at a persons public profile or in chat messaging). And to handle notifications settings for telegram, email, etc.   
 