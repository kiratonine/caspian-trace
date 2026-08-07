-- Preserve every immutable source item supporting a semantic station edge.
CREATE TYPE "StationRelationEvidenceBasis" AS ENUM (
  'OFFICIAL_PAIRED_ABOVE_BELOW_LABELS',
  'OFFICIAL_MONITORING_TABLE_SEQUENCE_AND_STATION_LABELS'
);

CREATE TABLE "station_relation_evidence" (
  "id" TEXT NOT NULL,
  "station_relation_id" TEXT NOT NULL,
  "source_document_id" TEXT NOT NULL,
  "source_page" INTEGER,
  "basis" "StationRelationEvidenceBasis" NOT NULL,
  "source_excerpt" TEXT NOT NULL,
  "checked_by" JSONB NOT NULL,
  "checked_at" TEXT NOT NULL,
  "verification_status" "VerificationStatus" NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "station_relation_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "station_relation_evidence_source_page_check"
    CHECK ("source_page" IS NULL OR "source_page" > 0),
  CONSTRAINT "station_relation_evidence_excerpt_check"
    CHECK (btrim("source_excerpt") <> ''),
  CONSTRAINT "station_relation_evidence_checked_by_check"
    CHECK (jsonb_typeof("checked_by") = 'array' AND jsonb_array_length("checked_by") > 0),
  CONSTRAINT "station_relation_evidence_checked_at_check"
    CHECK ("checked_at" ~ '^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])$'),
  CONSTRAINT "station_relation_evidence_edge_document_basis_key"
    UNIQUE ("station_relation_id", "source_document_id", "basis")
);

CREATE INDEX "station_relation_evidence_source_document_id_idx"
  ON "station_relation_evidence"("source_document_id");

ALTER TABLE "station_relation_evidence"
  ADD CONSTRAINT "station_relation_evidence_station_relation_id_fkey"
  FOREIGN KEY ("station_relation_id") REFERENCES "station_relations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "station_relation_evidence_source_document_id_fkey"
  FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "station_relation_evidence" ENABLE ROW LEVEL SECURITY;
