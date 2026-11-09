CREATE TABLE IF NOT EXISTS app_users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,tenant_id TEXT NOT NULL,payload TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS app_users_tenant ON app_users(tenant_id);
CREATE TABLE IF NOT EXISTS app_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL,payload TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS app_sessions_user ON app_sessions(user_id);
CREATE TABLE IF NOT EXISTS login_attempts(attempt_key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS auth_audit(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,payload TEXT NOT NULL);

