-- Semantic station edges are source-independent; provenance belongs to evidence rows.
ALTER TABLE "station_relations"
  ALTER COLUMN "source_document_id" DROP NOT NULL;

UPDATE "station_relations"
SET "source_document_id" = NULL,
    "notes" = NULL
WHERE "notes" LIKE '{"provenance":"station_relation_evidence"%';
