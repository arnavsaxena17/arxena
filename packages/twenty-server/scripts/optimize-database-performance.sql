-- Database Performance Optimization Script
-- Run this script to add recommended indexes for better query performance

-- 1. Feature Flags Table Optimizations
CREATE INDEX IF NOT EXISTS idx_feature_flag_workspace_key 
ON "core"."featureFlag" ("workspaceId", "key");

CREATE INDEX IF NOT EXISTS idx_feature_flag_key_value 
ON "core"."featureFlag" ("key", "value") 
WHERE "value" = true;

-- 2. Candidate Table Optimizations (assuming this is the main table being queried)
CREATE INDEX IF NOT EXISTS idx_candidate_jobs_engagement 
ON "candidate" ("jobsId", "engagementStatus", "startChat", "stopChat");

CREATE INDEX IF NOT EXISTS idx_candidate_updated_at 
ON "candidate" ("updatedAt");

CREATE INDEX IF NOT EXISTS idx_candidate_deleted_at 
ON "candidate" ("deletedAt") 
WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_engagement_status 
ON "candidate" ("engagementStatus", "updatedAt");

CREATE INDEX IF NOT EXISTS idx_candidate_start_chat 
ON "candidate" ("startChat", "stopChat", "updatedAt");

-- 3. WhatsApp Messages Table Optimizations
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_candidate 
ON "whatsappMessages" ("candidateId", "createdAt");

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at 
ON "whatsappMessages" ("createdAt");

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_job 
ON "whatsappMessages" ("jobsId", "createdAt");

-- 4. Jobs Table Optimizations
CREATE INDEX IF NOT EXISTS idx_jobs_active 
ON "jobs" ("isActive") 
WHERE "isActive" = true;

CREATE INDEX IF NOT EXISTS idx_jobs_name 
ON "jobs" ("name");

-- 5. Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_candidate_composite_1 
ON "candidate" ("jobsId", "engagementStatus", "startChat", "stopChat", "updatedAt");

CREATE INDEX IF NOT EXISTS idx_candidate_composite_2 
ON "candidate" ("jobsId", "startChat", "stopChat", "startChatCompleted", "updatedAt");

-- 6. Partial indexes for specific conditions
CREATE INDEX IF NOT EXISTS idx_candidate_active_engagement 
ON "candidate" ("jobsId", "engagementStatus", "updatedAt") 
WHERE "engagementStatus" = true AND "startChat" = true AND "stopChat" = false;

CREATE INDEX IF NOT EXISTS idx_candidate_inactive_engagement 
ON "candidate" ("jobsId", "engagementStatus", "updatedAt") 
WHERE "engagementStatus" = false AND "startChat" = true AND "stopChat" = false;

-- 7. Text search optimizations (if using full-text search)
CREATE INDEX IF NOT EXISTS idx_candidate_name_gin 
ON "candidate" USING gin(to_tsvector('english', "name"));

CREATE INDEX IF NOT EXISTS idx_jobs_name_gin 
ON "jobs" USING gin(to_tsvector('english', "name"));

-- 8. Foreign key optimizations
CREATE INDEX IF NOT EXISTS idx_candidate_jobs_id 
ON "candidate" ("jobsId");

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_jobs_id 
ON "whatsappMessages" ("jobsId");

-- 9. Date range query optimizations
CREATE INDEX IF NOT EXISTS idx_candidate_created_at 
ON "candidate" ("createdAt");

CREATE INDEX IF NOT EXISTS idx_candidate_updated_at_desc 
ON "candidate" ("updatedAt" DESC);

-- 10. Soft delete optimizations
CREATE INDEX IF NOT EXISTS idx_candidate_not_deleted 
ON "candidate" ("id") 
WHERE "deletedAt" IS NULL;

-- Analyze tables after creating indexes
ANALYZE "core"."featureFlag";
ANALYZE "candidate";
ANALYZE "whatsappMessages";
ANALYZE "jobs";

-- Check index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname IN ('core', 'public')
ORDER BY idx_scan DESC;

-- Check table statistics
SELECT 
    schemaname,
    tablename,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_live_tup,
    n_dead_tup
FROM pg_stat_user_tables
WHERE schemaname IN ('core', 'public')
ORDER BY n_live_tup DESC; 