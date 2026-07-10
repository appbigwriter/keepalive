import crypto from 'crypto';

export function generateBootstrapSql(): string {
    // Generate secure passwords for the roles
    const keepalivePassword = crypto.randomBytes(16).toString('hex');
    const backupPassword = crypto.randomBytes(16).toString('hex');

    const sql = `
-- ==============================================================================
-- KEEPALIVE & BACKUP BOOTSTRAP SNIPPET
-- Run this in the Supabase SQL Editor for your project.
-- Save the generated passwords to register the project in the KeepAlive Panel.
-- ==============================================================================

-- 1. Create the ping table for keep-alive
CREATE TABLE IF NOT EXISTS public.keepalive_ping (
    id SERIAL PRIMARY KEY,
    pinged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on the table but allow keepalive_role to bypass or insert
ALTER TABLE public.keepalive_ping ENABLE ROW LEVEL SECURITY;

-- 2. Create keepalive_role
-- Note: Re-running this will cause an error if the role already exists, 
-- which is fine, but you can comment it out if you are just updating.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'keepalive_role') THEN
    CREATE ROLE keepalive_role WITH LOGIN PASSWORD '${keepalivePassword}';
  ELSE
    ALTER ROLE keepalive_role WITH PASSWORD '${keepalivePassword}';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO keepalive_role;
GRANT INSERT, DELETE, SELECT ON public.keepalive_ping TO keepalive_role;
GRANT USAGE, SELECT ON SEQUENCE public.keepalive_ping_id_seq TO keepalive_role;

-- 3. Create backup_role (Read-only)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'backup_role') THEN
    CREATE ROLE backup_role WITH LOGIN PASSWORD '${backupPassword}';
  ELSE
    ALTER ROLE backup_role WITH PASSWORD '${backupPassword}';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO backup_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_role;
-- Set default privileges so future tables are also readable by backup_role
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backup_role;

-- IMPORTANT: The backup_role requires access to auth schema if Auth backups are enabled.
GRANT USAGE ON SCHEMA auth TO backup_role;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO backup_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT SELECT ON TABLES TO backup_role;

-- ==============================================================================
-- CREDENTIALS GENERATED (COPY THESE FOR THE PANEL)
-- Keepalive Password: ${keepalivePassword}
-- Backup Password: ${backupPassword}
-- ==============================================================================
`;

    return sql;
}

// If run directly, print out a snippet
if (require.main === module) {
    console.log(generateBootstrapSql());
}
