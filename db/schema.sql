-- Config DB Schema for KeepAlive System
-- Designed for Postgres

CREATE SCHEMA IF NOT EXISTS keepalive;
SET search_path TO keepalive;

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    management_token TEXT NOT NULL, -- Encrypted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    nickname VARCHAR(255) NOT NULL,
    phase VARCHAR(50) NOT NULL, -- dev, homolog, production
    criticality VARCHAR(50) NOT NULL,
    project_ref VARCHAR(255) NOT NULL UNIQUE,
    conn_string TEXT NOT NULL, -- Encrypted
    scope_buckets BOOLEAN DEFAULT FALSE,
    scope_edge BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'unknown', -- active, paused, at_risk, unknown
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE project_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    role_type VARCHAR(50) NOT NULL, -- keepalive, backup
    material TEXT NOT NULL, -- Encrypted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, role_type)
);

CREATE TABLE edge_function_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    function_name VARCHAR(255) NOT NULL,
    secret_name VARCHAR(255) NOT NULL,
    secret_value TEXT NOT NULL, -- Encrypted
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, function_name, secret_name)
);

CREATE TABLE keepalive_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    latency_ms INTEGER,
    error_message TEXT
);

CREATE TABLE backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL, -- pending, in_progress, completed, failed
    total_size_bytes BIGINT,
    checksum VARCHAR(255)
);

CREATE TABLE backup_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id UUID REFERENCES backups(id) ON DELETE CASCADE,
    layer VARCHAR(50) NOT NULL, -- postgres, auth, storage, edge
    local_path TEXT,
    offsite_path TEXT,
    size_bytes BIGINT,
    checksum VARCHAR(255),
    verified BOOLEAN DEFAULT FALSE
);

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    severity VARCHAR(50) NOT NULL, -- critical, urgent, warning
    alert_type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    state VARCHAR(50) DEFAULT 'open', -- open, resolved
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) DEFAULT 'operator', -- operator, admin
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target VARCHAR(255),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
