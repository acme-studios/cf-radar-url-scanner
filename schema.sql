-- Cloudflare Radar URL Scanner Database Schema
-- Sessions table for tracking scan jobs

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,              -- Session UUID (also R2 key prefix)
  url TEXT NOT NULL,                -- User-submitted URL
  email TEXT NOT NULL,              -- Destination email
  status TEXT NOT NULL,             -- Enum: queued, scanning, generating, uploading, sending, completed, failed, expired
  job_id TEXT,                      -- Internal job tracking ID (optional)
  radar_uuid TEXT,                  -- Radar scan UUID
  r2_key TEXT,                      -- R2 object key (sessions/{sessionId}/report.pdf)
  error TEXT,                       -- Error message (if failed)
  created_at INTEGER NOT NULL,      -- Unix timestamp (ms)
  updated_at INTEGER NOT NULL,      -- Unix timestamp (ms)
  expires_at INTEGER NOT NULL,      -- Unix timestamp (ms) - 24 hours from creation
  ip_address TEXT,                  -- Client IP (for analytics)
  user_agent TEXT,                  -- User agent (for analytics)
  country TEXT                      -- Cloudflare edge location
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);

-- Optional: Scan cache for duplicate URL detection (Phase 2)
CREATE TABLE IF NOT EXISTS scan_cache (
  url_hash TEXT PRIMARY KEY,        -- SHA-256 hash of normalized URL
  radar_uuid TEXT NOT NULL,         -- Cached Radar scan UUID
  result_json TEXT NOT NULL,        -- Cached Radar result (JSON string)
  cached_at INTEGER NOT NULL,       -- Unix timestamp (ms)
  expires_at INTEGER NOT NULL       -- Cache for 1 hour
);

CREATE INDEX IF NOT EXISTS idx_scan_cache_expires_at ON scan_cache(expires_at);
