ALTER TABLE "station_relations"
  ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "incidents"
  ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX "investigations_incident_id_input_hash_ruleset_version_key"
  ON "investigations"("incident_id", "input_hash", "ruleset_version");

DROP INDEX "evidence_statements_investigation_id_code_key";

CREATE INDEX "evidence_statements_investigation_id_code_idx"
  ON "evidence_statements"("investigation_id", "code");

CREATE UNIQUE INDEX "evidence_statements_investigation_id_sort_order_key"
  ON "evidence_statements"("investigation_id", "sort_order");

CREATE TABLE "investigation_candidate_object_evidence" (
  "investigation_id" TEXT NOT NULL,
  "candidate_object_id" TEXT NOT NULL,
  "evidence_statement_id" TEXT NOT NULL,

  CONSTRAINT "investigation_candidate_object_evidence_pkey"
    PRIMARY KEY ("investigation_id", "candidate_object_id", "evidence_statement_id")
);

ALTER TABLE "investigation_candidate_object_evidence"
  ADD CONSTRAINT "inv_candidate_evidence_disposition_fkey"
  FOREIGN KEY ("investigation_id", "candidate_object_id")
  REFERENCES "investigation_candidate_objects"("investigation_id", "candidate_object_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "investigation_candidate_object_evidence"
  ADD CONSTRAINT "inv_candidate_evidence_statement_fkey"
  FOREIGN KEY ("evidence_statement_id")
  REFERENCES "evidence_statements"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "investigation_candidate_object_evidence" ENABLE ROW LEVEL SECURITY;
