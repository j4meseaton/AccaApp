-- AssetSphere PostgreSQL Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE asset_type AS ENUM ('software','hardware','virtual','cloud','saas');
CREATE TYPE asset_status AS ENUM ('active','inactive','expiring','expired','retired','pending');
CREATE TYPE asset_source AS ENUM ('manual','nexthink','servicenow','intune','discovery');
CREATE TYPE license_type AS ENUM ('subscription','perpetual','oem','volume','open_source','freeware');
CREATE TYPE compliance_status AS ENUM ('compliant','at_risk','over_allocated','expired','unknown');
CREATE TYPE lifecycle_stage AS ENUM ('requested','approved','procurement','received','deployed','review','renewal','retired');
CREATE TYPE user_role AS ENUM ('admin','manager','viewer','requestor');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    azure_oid VARCHAR(36) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    department VARCHAR(100),
    role user_role NOT NULL DEFAULT 'viewer',
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    asset_type asset_type NOT NULL,
    vendor VARCHAR(255),
    version VARCHAR(100),
    serial_number VARCHAR(255),
    assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    department VARCHAR(100),
    status asset_status NOT NULL DEFAULT 'active',
    purchase_date DATE,
    expiry_date DATE,
    support_end_date DATE,
    cost DECIMAL(12,2),
    currency CHAR(3) DEFAULT 'GBP',
    license_type license_type,
    contract_ref VARCHAR(255),
    source asset_source NOT NULL DEFAULT 'manual',
    source_id VARCHAR(255),
    last_seen TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE asset_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    seats_purchased INTEGER NOT NULL DEFAULT 1,
    seats_in_use INTEGER NOT NULL DEFAULT 0,
    compliance_status compliance_status NOT NULL DEFAULT 'unknown',
    vendor_contract_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE license_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used TIMESTAMPTZ,
    UNIQUE(license_id, user_id)
);

CREATE TABLE lifecycle_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    stage lifecycle_stage NOT NULL,
    previous_stage lifecycle_stage,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    servicenow_ticket VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE integration_sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_type ON assets(asset_type);
CREATE INDEX idx_assets_expiry ON assets(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_assets_source ON assets(source);
CREATE INDEX idx_lifecycle_asset ON lifecycle_events(asset_id);
CREATE INDEX idx_license_asset ON licenses(asset_id);
CREATE INDEX idx_assignments_license ON license_assignments(license_id);
CREATE INDEX idx_sync_log_integration ON integration_sync_log(integration_name, started_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER licenses_updated_at BEFORE UPDATE ON licenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO users (azure_oid, email, display_name, department, role) VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin@example.com', 'Admin User', 'IT', 'admin'),
    ('00000000-0000-0000-0000-000000000002', 'james.eaton@example.com', 'James Eaton', 'IT', 'admin');
