CREATE TABLE IF NOT EXISTS restaurants(
 id text PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL,
 currency text NOT NULL, timezone text NOT NULL, key_hash text NOT NULL);
CREATE TABLE IF NOT EXISTS snapshots(
 restaurant_id text NOT NULL REFERENCES restaurants(id), day date NOT NULL,
 sequence bigint NOT NULL, payload jsonb NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(restaurant_id,day));
CREATE INDEX IF NOT EXISTS restaurants_tenant ON restaurants(tenant_id);
CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY);
INSERT INTO schema_migrations VALUES(1) ON CONFLICT DO NOTHING;
