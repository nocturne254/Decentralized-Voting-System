-- Enhanced Features Database Schema Migration
-- Adds support for candidate photos, manifestos, live tally, and performance tracking

-- Enhanced Candidates Table
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS affiliation VARCHAR(255);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS short_summary TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS photo_hash VARCHAR(64);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS photo_alt_text TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS manifesto_id UUID;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Candidate Photos Table
CREATE TABLE IF NOT EXISTS candidate_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    original_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500) NOT NULL,
    medium_url VARCHAR(500) NOT NULL,
    hash VARCHAR(64) NOT NULL UNIQUE,
    alt_text TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Candidate Manifestos Table
CREATE TABLE IF NOT EXISTS candidate_manifestos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifesto_id VARCHAR(100) NOT NULL UNIQUE,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    content TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    hash VARCHAR(64) NOT NULL,
    published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_manifesto_candidate (candidate_id),
    INDEX idx_manifesto_tenant (tenant_id),
    INDEX idx_manifesto_published (published)
);

-- Manifesto Attachments Table
CREATE TABLE IF NOT EXISTS manifesto_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id VARCHAR(100) NOT NULL UNIQUE,
    manifesto_id VARCHAR(100) NOT NULL REFERENCES candidate_manifestos(manifesto_id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manifesto Pledges Table
CREATE TABLE IF NOT EXISTS manifesto_pledges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pledge_id VARCHAR(100) NOT NULL UNIQUE,
    manifesto_id VARCHAR(100) NOT NULL REFERENCES candidate_manifestos(manifesto_id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    measurable BOOLEAN DEFAULT FALSE,
    target_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pledge_manifesto (manifesto_id),
    INDEX idx_pledge_category (category)
);

-- Live Tally Configuration Table
CREATE TABLE IF NOT EXISTS tally_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    election_id UUID NOT NULL,
    mode VARCHAR(20) NOT NULL DEFAULT 'disabled' CHECK (mode IN ('live', 'delayed', 'admin_only', 'disabled')),
    delay_minutes INTEGER DEFAULT 0,
    update_interval INTEGER DEFAULT 5000,
    enable_deltas BOOLEAN DEFAULT TRUE,
    delta_interval INTEGER DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, election_id)
);

-- Vote Commitments Table (for live tally)
CREATE TABLE IF NOT EXISTS vote_commitments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL,
    commitment_hash VARCHAR(64) NOT NULL,
    nullifier_hash VARCHAR(64) NOT NULL UNIQUE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    block_number BIGINT,
    transaction_hash VARCHAR(66),
    verified BOOLEAN DEFAULT FALSE,
    INDEX idx_commitment_election (election_id),
    INDEX idx_commitment_nullifier (nullifier_hash),
    INDEX idx_commitment_timestamp (timestamp)
);

-- Tally History Table
CREATE TABLE IF NOT EXISTS tally_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_votes INTEGER NOT NULL DEFAULT 0,
    candidate_data JSONB NOT NULL DEFAULT '[]',
    deltas JSONB DEFAULT '[]',
    INDEX idx_tally_election (election_id),
    INDEX idx_tally_timestamp (timestamp)
);

-- Pledge Ratings Table
CREATE TABLE IF NOT EXISTS pledge_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rating_id VARCHAR(100) NOT NULL UNIQUE,
    tenant_id UUID NOT NULL,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    pledge_id VARCHAR(100) NOT NULL REFERENCES manifesto_pledges(pledge_id) ON DELETE CASCADE,
    rater_id VARCHAR(64) NOT NULL, -- Hashed for anonymity
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    rating_period VARCHAR(50) NOT NULL,
    anonymous BOOLEAN DEFAULT TRUE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, pledge_id, rater_id, rating_period),
    INDEX idx_rating_pledge (pledge_id),
    INDEX idx_rating_candidate (candidate_id),
    INDEX idx_rating_tenant (tenant_id),
    INDEX idx_rating_period (rating_period)
);

-- Pledge Performance Cache Table
CREATE TABLE IF NOT EXISTS pledge_performances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pledge_id VARCHAR(100) NOT NULL REFERENCES manifesto_pledges(pledge_id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    average_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    total_ratings INTEGER NOT NULL DEFAULT 0,
    score_distribution JSONB DEFAULT '{}',
    trend VARCHAR(20) DEFAULT 'stable' CHECK (trend IN ('improving', 'declining', 'stable')),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pledge_id),
    INDEX idx_performance_candidate (candidate_id),
    INDEX idx_performance_score (average_score)
);

-- Tenant Configurations Table
CREATE TABLE IF NOT EXISTS tenant_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE,
    organization_name VARCHAR(255) NOT NULL,
    features JSONB NOT NULL DEFAULT '{}',
    settings JSONB NOT NULL DEFAULT '{}',
    data_region VARCHAR(50) NOT NULL DEFAULT 'global',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Voter Receipts Table
CREATE TABLE IF NOT EXISTS voter_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id VARCHAR(100) NOT NULL UNIQUE,
    election_id UUID NOT NULL,
    voter_hash VARCHAR(64) NOT NULL,
    vote_hash VARCHAR(64) NOT NULL,
    verification_url VARCHAR(500) NOT NULL,
    qr_code TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_receipt_election (election_id),
    INDEX idx_receipt_voter (voter_hash)
);

-- Vote Confirmations Table (for grace period)
CREATE TABLE IF NOT EXISTS vote_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vote_id VARCHAR(100) NOT NULL UNIQUE,
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    candidate_name VARCHAR(255) NOT NULL,
    grace_period_end TIMESTAMP NOT NULL,
    confirmed BOOLEAN DEFAULT FALSE,
    undone BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_confirmation_candidate (candidate_id),
    INDEX idx_confirmation_grace_period (grace_period_end)
);

-- Rate Limiting Table
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rater_id VARCHAR(64) NOT NULL,
    tenant_id UUID NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    reset_time TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rater_id, tenant_id, action_type),
    INDEX idx_rate_limit_reset (reset_time)
);

-- Audit Trail Table (enhanced)
CREATE TABLE IF NOT EXISTS audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    election_id UUID,
    action VARCHAR(100) NOT NULL,
    actor VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_tenant (tenant_id),
    INDEX idx_audit_election (election_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_timestamp (timestamp)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_candidates_election ON candidates(election_id);
CREATE INDEX IF NOT EXISTS idx_candidates_manifesto ON candidates(manifesto_id);
CREATE INDEX IF NOT EXISTS idx_photos_candidate ON candidate_photos(candidate_id);
CREATE INDEX IF NOT EXISTS idx_photos_hash ON candidate_photos(hash);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tally_config_updated_at BEFORE UPDATE ON tally_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_config_updated_at BEFORE UPDATE ON tenant_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default tenant configuration
INSERT INTO tenant_configurations (tenant_id, organization_name, features, settings, data_region)
VALUES (
    gen_random_uuid(),
    'Default Organization',
    '{
        "liveTally": "disabled",
        "manifestoTracker": false,
        "anonymousRatings": true,
        "candidatePhotos": true,
        "richManifestos": true,
        "uiEnhancements": true
    }',
    '{
        "gracePeriodSeconds": 20,
        "autoSaveInterval": 30000,
        "rateLimitPerUser": 10,
        "minRatingsForDisplay": 5,
        "delayMinutes": 0
    }',
    'global'
) ON CONFLICT (tenant_id) DO NOTHING;

-- Create views for common queries
CREATE OR REPLACE VIEW enhanced_candidates AS
SELECT 
    c.*,
    cp.original_url as photo_original_url,
    cp.thumbnail_url as photo_thumbnail_url,
    cp.alt_text as photo_alt_text,
    cm.content as manifesto_content,
    cm.published as manifesto_published,
    cm.version as manifesto_version,
    COUNT(mp.id) as pledge_count
FROM candidates c
LEFT JOIN candidate_photos cp ON c.id = cp.candidate_id
LEFT JOIN candidate_manifestos cm ON c.manifesto_id = cm.manifesto_id
LEFT JOIN manifesto_pledges mp ON cm.manifesto_id = mp.manifesto_id
GROUP BY c.id, cp.id, cm.id;

CREATE OR REPLACE VIEW candidate_performance_summary AS
SELECT 
    c.id as candidate_id,
    c.name as candidate_name,
    AVG(pp.average_score) as overall_score,
    COUNT(pp.id) as total_pledges,
    SUM(pp.total_ratings) as total_ratings,
    MAX(pp.last_updated) as last_rated
FROM candidates c
JOIN candidate_manifestos cm ON c.manifesto_id = cm.manifesto_id
JOIN manifesto_pledges mp ON cm.manifesto_id = mp.manifesto_id
JOIN pledge_performances pp ON mp.pledge_id = pp.pledge_id
GROUP BY c.id, c.name;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO voting_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO voting_app;
