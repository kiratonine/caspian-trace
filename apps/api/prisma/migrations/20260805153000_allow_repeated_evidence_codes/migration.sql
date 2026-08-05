-- A rule can yield one evidence statement per comparable interval. Rule codes
-- therefore classify statements but do not uniquely identify them.
DROP INDEX "evidence_statements_investigation_id_code_key";

CREATE INDEX "evidence_statements_investigation_id_code_idx"
  ON "evidence_statements" ("investigation_id", "code");
