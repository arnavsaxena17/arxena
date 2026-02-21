-- Remove MANY_TO_ONE relation metadata for workspace fe44a968-cba2-429c-b9a1-73869e852a9c
-- These were added by mistake (assistantThread->job, assistantThreadCandidate->candidate/job/person).
-- Run this on the **metadata** (core) database, not the workspace schema.
--
-- Usage (from app.arxena.com or wherever the DB host is):
--   psql -h <host> -U <user> -d <metadata_db_name> -f remove-many-to-one-relations-production.sql
--
-- Or connect first then run:
--   \i remove-many-to-one-relations-production.sql

-- Preview: see rows that will be deleted (optional, run first to confirm)
-- SELECT id, "relationType", "fromObjectMetadataId", "toObjectMetadataId", "fromFieldMetadataId", "toFieldMetadataId"
-- FROM metadata."relationMetadata"
-- WHERE "workspaceId" = 'fe44a968-cba2-429c-b9a1-73869e852a9c'
--   AND "relationType" = 'MANY_TO_ONE';

BEGIN;

DELETE FROM metadata."relationMetadata"
WHERE "workspaceId" = 'fe44a968-cba2-429c-b9a1-73869e852a9c'
  AND "relationType" = 'MANY_TO_ONE';
-- Expected: DELETE 4

COMMIT;

-- ---------------------------------------------------------------------------
-- After running this SQL you must:
-- 1. Run remove-orphaned-relation-field-metadata.sql on the same metadata DB.
--    Deleting relation metadata leaves field metadata rows with type = 'RELATION'
--    but no relation; the server then throws "Relation metadata is missing for
--    field <name>" when building the workspace schema. The orphan script
--    removes those fields.
-- 2. Deploy the new twenty-server code (so dist includes MANY_TO_ONE handling
--    in compute-relation-type.util.js). Otherwise the server can still throw
--    "Invalid relation type" if cached metadata still referenced MANY_TO_ONE.
-- 3. Invalidate the workspace metadata cache so the next request recomputes
--    from DB. From the app server (e.g. app.arxena.com):
--
--    cd /path/to/twenty && yarn run cache:flush -p 'engine:workspace:metadata:workspace-metadata-version:fe44a968-cba2-429c-b9a1-73869e852a9c'
--
--    Or clear all workspace metadata versions (forces recompute for every workspace):
--
--    yarn run cache:flush -p 'engine:workspace:metadata:workspace-metadata-version:*'
-- ---------------------------------------------------------------------------
