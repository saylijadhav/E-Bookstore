-- Least-privilege grants for the application role (no DDL, no TRUNCATE, no superuser).
-- Usage: psql -d bookworm -v app_role=bookworm_app -f db/grants.sql
GRANT USAGE ON SCHEMA public TO :"app_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"app_role";
