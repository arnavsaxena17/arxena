-- Remove field metadata rows that have type = 'RELATION' but no corresponding
-- row in relationMetadata (e.g. after relation metadata was deleted manually
-- or by remove-many-to-one-relations-production.sql).
--
-- This fixes: "Relation metadata is missing for field <name>" on login.
--
-- Run on the **metadata** database:
--   psql -h <host> -U <user> -d <metadata_db_name> -f remove-orphaned-relation-field-metadata.sql
--
-- Or: \i remove-orphaned-relation-field-metadata.sql

-- Preview: see orphaned relation fields (optional)
-- SELECT f.id, f.name, f."objectMetadataId", o."nameSingular" AS object_name
-- FROM metadata."fieldMetadata" f
-- JOIN metadata."objectMetadata" o ON o.id = f."objectMetadataId"
-- WHERE f.type = 'RELATION'
--   AND f.id NOT IN (
--     SELECT "fromFieldMetadataId" FROM metadata."relationMetadata"
--     UNION
--     SELECT "toFieldMetadataId" FROM metadata."relationMetadata"
--   );

BEGIN;

DELETE FROM metadata."fieldMetadata"
WHERE type = 'RELATION'
  AND id NOT IN (
    SELECT "fromFieldMetadataId" FROM metadata."relationMetadata"
    UNION
    SELECT "toFieldMetadataId" FROM metadata."relationMetadata"
  );

COMMIT;

-- ---------------------------------------------------------------------------
-- After running:
-- Invalidate the workspace metadata cache so the next request recomputes.
-- From the app server (e.g. for one workspace):
--   yarn run cache:flush -p 'engine:workspace:metadata:workspace-metadata-version:<workspaceId>'
--
-- Or clear all workspace metadata versions:
--   yarn run cache:flush -p 'engine:workspace:metadata:workspace-metadata-version:*'
-- ---------------------------------------------------------------------------
