-- Distinct pages may support the same edge; unknown pages deduplicate as one value.
ALTER TABLE "station_relation_evidence"
  DROP CONSTRAINT "station_relation_evidence_edge_document_basis_key",
  ADD CONSTRAINT "station_relation_evidence_edge_document_basis_page_key"
    UNIQUE NULLS NOT DISTINCT (
      "station_relation_id",
      "source_document_id",
      "basis",
      "source_page"
    );
