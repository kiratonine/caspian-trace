-- Preserve source provenance once referenced by accepted domain records.
ALTER TABLE "measurements"
  DROP CONSTRAINT "measurements_source_document_id_fkey",
  DROP CONSTRAINT "measurements_source_page_id_fkey";

ALTER TABLE "incident_signals"
  DROP CONSTRAINT "incident_signals_source_document_id_fkey";

ALTER TABLE "candidate_object_sources"
  DROP CONSTRAINT "candidate_object_sources_source_document_id_fkey";

CREATE UNIQUE INDEX "source_pages_id_source_document_id_key"
  ON "source_pages" ("id", "source_document_id");

ALTER TABLE "measurements"
  ADD CONSTRAINT "measurements_source_document_id_fkey"
    FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "measurements_source_page_id_source_document_id_fkey"
    FOREIGN KEY ("source_page_id", "source_document_id")
    REFERENCES "source_pages"("id", "source_document_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "incident_signals"
  ADD CONSTRAINT "incident_signals_source_document_id_fkey"
    FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "candidate_object_sources"
  ADD CONSTRAINT "candidate_object_sources_source_document_id_fkey"
    FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
