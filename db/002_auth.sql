CREATE TABLE IF NOT EXISTS app_users(id text PRIMARY KEY,email text NOT NULL UNIQUE,tenant_id text NOT NULL,payload jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS app_users_tenant ON app_users(tenant_id);
CREATE TABLE IF NOT EXISTS app_sessions(token_hash text PRIMARY KEY,user_id text NOT NULL REFERENCES app_users(id),expires bigint NOT NULL,payload jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS app_sessions_user ON app_sessions(user_id);
CREATE TABLE IF NOT EXISTS login_attempts(attempt_key text PRIMARY KEY,count integer NOT NULL,reset_at bigint NOT NULL);
CREATE TABLE IF NOT EXISTS auth_audit(id text PRIMARY KEY,tenant_id text NOT NULL,payload jsonb NOT NULL);
INSERT INTO schema_migrations VALUES(2) ON CONFLICT DO NOTHING;

