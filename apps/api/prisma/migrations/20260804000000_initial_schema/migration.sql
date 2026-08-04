-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EvidenceLevel" AS ENUM ('L0', 'L1', 'L2', 'L3');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('ATYRAU', 'MANGYSTAU');

-- CreateEnum
CREATE TYPE "ExtractionMode" AS ENUM ('LLM_VERIFIED', 'RULE', 'VERIFIED_SEED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'CORROBORATED', 'OFFICIAL', 'CONFLICTING');

-- CreateEnum
CREATE TYPE "SourceDocumentStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "StationRelationKind" AS ENUM ('UPSTREAM_OF', 'DOWNSTREAM_OF', 'SAME_REACH');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CorridorKind" AS ENUM ('NONE', 'BETWEEN_STATIONS', 'OPEN_UPSTREAM', 'OPEN_DOWNSTREAM');

-- CreateEnum
CREATE TYPE "CandidateDisposition" AS ENUM ('FOR_CHECK', 'OUTSIDE_CORRIDOR', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('SUPPORTS', 'CONTRADICTS', 'LIMITS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EvidenceGeneratedBy" AS ENUM ('RULE_ENGINE', 'HUMAN_VERIFIED');

-- CreateEnum
CREATE TYPE "ReplayStepType" AS ENUM ('SIGNAL', 'CORROBORATION', 'MEASUREMENT', 'INFERENCE', 'CONCLUSION');

-- CreateEnum
CREATE TYPE "IngestionAdapter" AS ENUM ('KAZHYDROMET', 'GDELT', 'DIRECT_SOURCE', 'VERIFIED_MANIFEST');

-- CreateEnum
CREATE TYPE "IngestionRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'RATE_LIMITED');

-- CreateEnum
CREATE TYPE "SourceHealthStatus" AS ENUM ('NEVER_RUN', 'HEALTHY', 'DEGRADED', 'RATE_LIMITED', 'FAILED');

-- CreateTable
CREATE TABLE "source_documents" (
    "id" TEXT NOT NULL,
    "original_url" TEXT NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "published_period" TEXT,
    "fetched_at" TIMESTAMPTZ(3),
    "sha256" CHAR(64),
    "cache_path" TEXT,
    "http_status" INTEGER,
    "status" "SourceDocumentStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "extraction_metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "source_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_pages" (
    "id" TEXT NOT NULL,
    "source_document_id" TEXT NOT NULL,
    "page_number" INTEGER NOT NULL,
    "extracted_text" TEXT NOT NULL,
    "text_sha256" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "water_body" TEXT NOT NULL,
    "region" "Region" NOT NULL,
    "location_text" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "location_source_document_id" TEXT,
    "river_order" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "station_relations" (
    "id" TEXT NOT NULL,
    "from_station_id" TEXT NOT NULL,
    "to_station_id" TEXT NOT NULL,
    "kind" "StationRelationKind" NOT NULL,
    "source_document_id" TEXT NOT NULL,
    "verification_status" "VerificationStatus" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "station_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurements" (
    "id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "source_document_id" TEXT NOT NULL,
    "source_page_id" TEXT,
    "indicator" TEXT NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "raw_value_text" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "matrix" TEXT NOT NULL,
    "sampled_at" TIMESTAMPTZ(3),
    "sampled_period" TEXT,
    "source_excerpt" TEXT,
    "extraction_mode" "ExtractionMode" NOT NULL,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_signals" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "observed_at" TIMESTAMPTZ(3),
    "observed_period" TEXT,
    "reported_at" TIMESTAMPTZ(3) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "location_text" TEXT,
    "phenomenon" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "source_document_id" TEXT NOT NULL,
    "extraction_mode" "ExtractionMode" NOT NULL,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "dedup_key" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "region" "Region" NOT NULL,
    "indicator" TEXT,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_signal_links" (
    "incident_id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,

    CONSTRAINT "incident_signal_links_pkey" PRIMARY KEY ("incident_id","signal_id")
);

-- CreateTable
CREATE TABLE "candidate_objects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "activity" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "geometry_source_document_id" TEXT,
    "basis_text" TEXT NOT NULL,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "candidate_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_object_sources" (
    "candidate_object_id" TEXT NOT NULL,
    "source_document_id" TEXT NOT NULL,

    CONSTRAINT "candidate_object_sources_pkey" PRIMARY KEY ("candidate_object_id","source_document_id")
);

-- CreateTable
CREATE TABLE "investigations" (
    "id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "evidence_level" "EvidenceLevel" NOT NULL,
    "conclusion" TEXT NOT NULL,
    "corridor_kind" "CorridorKind" NOT NULL DEFAULT 'NONE',
    "upstream_station_id" TEXT,
    "downstream_station_id" TEXT,
    "ruleset_version" TEXT,
    "input_hash" CHAR(64),
    "generated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "investigations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_measurements" (
    "investigation_id" TEXT NOT NULL,
    "measurement_id" TEXT NOT NULL,

    CONSTRAINT "investigation_measurements_pkey" PRIMARY KEY ("investigation_id","measurement_id")
);

-- CreateTable
CREATE TABLE "investigation_candidate_objects" (
    "investigation_id" TEXT NOT NULL,
    "candidate_object_id" TEXT NOT NULL,
    "disposition" "CandidateDisposition" NOT NULL DEFAULT 'FOR_CHECK',
    "note" TEXT,

    CONSTRAINT "investigation_candidate_objects_pkey" PRIMARY KEY ("investigation_id","candidate_object_id")
);

-- CreateTable
CREATE TABLE "evidence_statements" (
    "id" TEXT NOT NULL,
    "investigation_id" TEXT NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "code" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "generated_by" "EvidenceGeneratedBy" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "evidence_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_statement_measurements" (
    "evidence_statement_id" TEXT NOT NULL,
    "measurement_id" TEXT NOT NULL,

    CONSTRAINT "evidence_statement_measurements_pkey" PRIMARY KEY ("evidence_statement_id","measurement_id")
);

-- CreateTable
CREATE TABLE "evidence_statement_sources" (
    "evidence_statement_id" TEXT NOT NULL,
    "source_document_id" TEXT NOT NULL,

    CONSTRAINT "evidence_statement_sources_pkey" PRIMARY KEY ("evidence_statement_id","source_document_id")
);

-- CreateTable
CREATE TABLE "investigation_unknowns" (
    "id" TEXT NOT NULL,
    "investigation_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "investigation_unknowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replay_scenarios" (
    "id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "replay_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replay_steps" (
    "id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "offset_ms" INTEGER NOT NULL,
    "type" "ReplayStepType" NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "replay_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_runs" (
    "id" TEXT NOT NULL,
    "adapter" "IngestionAdapter" NOT NULL,
    "status" "IngestionRunStatus" NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "fetched_count" INTEGER NOT NULL DEFAULT 0,
    "accepted_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "error_code" TEXT,
    "error_message" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_health" (
    "source_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "SourceHealthStatus" NOT NULL DEFAULT 'NEVER_RUN',
    "last_attempt_at" TIMESTAMPTZ(3),
    "last_success_at" TIMESTAMPTZ(3),
    "last_http_status" INTEGER,
    "cache_available" BOOLEAN NOT NULL DEFAULT false,
    "consecutive_errors" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "source_health_pkey" PRIMARY KEY ("source_id")
);

-- CreateIndex
CREATE INDEX "source_documents_published_at_idx" ON "source_documents"("published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "source_documents_canonical_url_sha256_key" ON "source_documents"("canonical_url", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "source_pages_source_document_id_page_number_key" ON "source_pages"("source_document_id", "page_number");

-- CreateIndex
CREATE INDEX "stations_water_body_region_idx" ON "stations"("water_body", "region");

-- CreateIndex
CREATE UNIQUE INDEX "station_relations_from_station_id_to_station_id_kind_key" ON "station_relations"("from_station_id", "to_station_id", "kind");

-- CreateIndex
CREATE INDEX "measurements_station_id_indicator_sampled_at_idx" ON "measurements"("station_id", "indicator", "sampled_at" DESC);

-- CreateIndex
CREATE INDEX "measurements_station_id_indicator_sampled_period_idx" ON "measurements"("station_id", "indicator", "sampled_period");

-- CreateIndex
CREATE INDEX "measurements_source_document_id_idx" ON "measurements"("source_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "incident_signals_dedup_key_source_document_id_key" ON "incident_signals"("dedup_key", "source_document_id");

-- CreateIndex
CREATE INDEX "incident_signals_reported_at_idx" ON "incident_signals"("reported_at" DESC);

-- CreateIndex
CREATE INDEX "incidents_created_at_idx" ON "incidents"("created_at" DESC);

-- CreateIndex
CREATE INDEX "incidents_updated_at_idx" ON "incidents"("updated_at" DESC);

-- CreateIndex
CREATE INDEX "investigations_incident_id_generated_at_idx" ON "investigations"("incident_id", "generated_at" DESC);

-- CreateIndex
CREATE INDEX "investigations_incident_id_is_current_idx" ON "investigations"("incident_id", "is_current");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_statements_investigation_id_code_key" ON "evidence_statements"("investigation_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "investigation_unknowns_investigation_id_code_key" ON "investigation_unknowns"("investigation_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "replay_steps_scenario_id_offset_ms_type_key" ON "replay_steps"("scenario_id", "offset_ms", "type");

-- CreateIndex
CREATE INDEX "replay_steps_scenario_id_offset_ms_idx" ON "replay_steps"("scenario_id", "offset_ms");

-- CreateIndex
CREATE INDEX "ingestion_runs_adapter_started_at_idx" ON "ingestion_runs"("adapter", "started_at" DESC);

-- AddForeignKey
ALTER TABLE "source_pages" ADD CONSTRAINT "source_pages_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_location_source_document_id_fkey" FOREIGN KEY ("location_source_document_id") REFERENCES "source_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_relations" ADD CONSTRAINT "station_relations_from_station_id_fkey" FOREIGN KEY ("from_station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_relations" ADD CONSTRAINT "station_relations_to_station_id_fkey" FOREIGN KEY ("to_station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_relations" ADD CONSTRAINT "station_relations_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_source_page_id_fkey" FOREIGN KEY ("source_page_id") REFERENCES "source_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_signals" ADD CONSTRAINT "incident_signals_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_signal_links" ADD CONSTRAINT "incident_signal_links_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_signal_links" ADD CONSTRAINT "incident_signal_links_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "incident_signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_objects" ADD CONSTRAINT "candidate_objects_geometry_source_document_id_fkey" FOREIGN KEY ("geometry_source_document_id") REFERENCES "source_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_object_sources" ADD CONSTRAINT "candidate_object_sources_candidate_object_id_fkey" FOREIGN KEY ("candidate_object_id") REFERENCES "candidate_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_object_sources" ADD CONSTRAINT "candidate_object_sources_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_upstream_station_id_fkey" FOREIGN KEY ("upstream_station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_downstream_station_id_fkey" FOREIGN KEY ("downstream_station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_measurements" ADD CONSTRAINT "investigation_measurements_investigation_id_fkey" FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_measurements" ADD CONSTRAINT "investigation_measurements_measurement_id_fkey" FOREIGN KEY ("measurement_id") REFERENCES "measurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_candidate_objects" ADD CONSTRAINT "investigation_candidate_objects_investigation_id_fkey" FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_candidate_objects" ADD CONSTRAINT "investigation_candidate_objects_candidate_object_id_fkey" FOREIGN KEY ("candidate_object_id") REFERENCES "candidate_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_statements" ADD CONSTRAINT "evidence_statements_investigation_id_fkey" FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_statement_measurements" ADD CONSTRAINT "evidence_statement_measurements_evidence_statement_id_fkey" FOREIGN KEY ("evidence_statement_id") REFERENCES "evidence_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_statement_measurements" ADD CONSTRAINT "evidence_statement_measurements_measurement_id_fkey" FOREIGN KEY ("measurement_id") REFERENCES "measurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_statement_sources" ADD CONSTRAINT "evidence_statement_sources_evidence_statement_id_fkey" FOREIGN KEY ("evidence_statement_id") REFERENCES "evidence_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_statement_sources" ADD CONSTRAINT "evidence_statement_sources_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_unknowns" ADD CONSTRAINT "investigation_unknowns_investigation_id_fkey" FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replay_scenarios" ADD CONSTRAINT "replay_scenarios_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replay_steps" ADD CONSTRAINT "replay_steps_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "replay_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domain integrity constraints that Prisma cannot express.
ALTER TABLE "source_documents"
  ADD CONSTRAINT "source_documents_urls_nonempty_check" CHECK (btrim("original_url") <> '' AND btrim("canonical_url") <> ''),
  ADD CONSTRAINT "source_documents_sha256_check" CHECK ("sha256" IS NULL OR "sha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "source_documents_published_period_check" CHECK ("published_period" IS NULL OR "published_period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT "source_documents_verified_provenance_check" CHECK ("status" <> 'VERIFIED' OR ("sha256" IS NOT NULL AND "fetched_at" IS NOT NULL));

ALTER TABLE "source_pages"
  ADD CONSTRAINT "source_pages_page_number_check" CHECK ("page_number" > 0),
  ADD CONSTRAINT "source_pages_text_sha256_check" CHECK ("text_sha256" ~ '^[0-9a-f]{64}$');

ALTER TABLE "stations"
  ADD CONSTRAINT "stations_coordinates_pair_check" CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
  ADD CONSTRAINT "stations_latitude_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "stations_longitude_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "stations_unknown_coordinate_sentinel_check" CHECK ("latitude" IS NULL OR "latitude" <> 0 OR "longitude" <> 0),
  ADD CONSTRAINT "stations_location_provenance_check" CHECK (("latitude" IS NULL) = ("location_source_document_id" IS NULL)),
  ADD CONSTRAINT "stations_river_order_check" CHECK ("river_order" IS NULL OR "river_order" > 0);

ALTER TABLE "station_relations"
  ADD CONSTRAINT "station_relations_distinct_stations_check" CHECK ("from_station_id" <> "to_station_id");

ALTER TABLE "measurements"
  ADD CONSTRAINT "measurements_sample_time_check" CHECK (("sampled_at" IS NULL) <> ("sampled_period" IS NULL)),
  ADD CONSTRAINT "measurements_sampled_period_check" CHECK ("sampled_period" IS NULL OR "sampled_period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT "measurements_raw_value_check" CHECK (btrim("raw_value_text") <> ''),
  ADD CONSTRAINT "measurements_verified_excerpt_check" CHECK ("verification_status" NOT IN ('CORROBORATED', 'OFFICIAL') OR ("source_excerpt" IS NOT NULL AND btrim("source_excerpt") <> ''));

ALTER TABLE "incident_signals"
  ADD CONSTRAINT "incident_signals_observed_time_check" CHECK ("observed_at" IS NULL OR "observed_period" IS NULL),
  ADD CONSTRAINT "incident_signals_observed_period_check" CHECK ("observed_period" IS NULL OR "observed_period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT "incident_signals_coordinates_pair_check" CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
  ADD CONSTRAINT "incident_signals_latitude_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "incident_signals_longitude_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "incident_signals_unknown_coordinate_sentinel_check" CHECK ("latitude" IS NULL OR "latitude" <> 0 OR "longitude" <> 0);

ALTER TABLE "candidate_objects"
  ADD CONSTRAINT "candidate_objects_basis_text_check" CHECK (btrim("basis_text") <> ''),
  ADD CONSTRAINT "candidate_objects_coordinates_pair_check" CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
  ADD CONSTRAINT "candidate_objects_latitude_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "candidate_objects_longitude_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "candidate_objects_unknown_coordinate_sentinel_check" CHECK ("latitude" IS NULL OR "latitude" <> 0 OR "longitude" <> 0),
  ADD CONSTRAINT "candidate_objects_geometry_provenance_check" CHECK (("latitude" IS NULL) = ("geometry_source_document_id" IS NULL));

ALTER TABLE "investigations"
  ADD CONSTRAINT "investigations_input_hash_check" CHECK ("input_hash" IS NULL OR "input_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "investigations_corridor_bounds_check" CHECK (
    ("corridor_kind" = 'NONE' AND "upstream_station_id" IS NULL AND "downstream_station_id" IS NULL) OR
    ("corridor_kind" = 'BETWEEN_STATIONS' AND "upstream_station_id" IS NOT NULL AND "downstream_station_id" IS NOT NULL AND "upstream_station_id" <> "downstream_station_id") OR
    ("corridor_kind" = 'OPEN_UPSTREAM' AND "upstream_station_id" IS NULL AND "downstream_station_id" IS NOT NULL) OR
    ("corridor_kind" = 'OPEN_DOWNSTREAM' AND "upstream_station_id" IS NOT NULL AND "downstream_station_id" IS NULL)
  );

CREATE UNIQUE INDEX "investigations_one_current_per_incident_key"
  ON "investigations" ("incident_id") WHERE "is_current";

ALTER TABLE "evidence_statements"
  ADD CONSTRAINT "evidence_statements_sort_order_check" CHECK ("sort_order" >= 0);

ALTER TABLE "investigation_unknowns"
  ADD CONSTRAINT "investigation_unknowns_sort_order_check" CHECK ("sort_order" >= 0);

ALTER TABLE "replay_steps"
  ADD CONSTRAINT "replay_steps_offset_ms_check" CHECK ("offset_ms" >= 0);

ALTER TABLE "ingestion_runs"
  ADD CONSTRAINT "ingestion_runs_counts_check" CHECK ("fetched_count" >= 0 AND "accepted_count" >= 0 AND "rejected_count" >= 0),
  ADD CONSTRAINT "ingestion_runs_finished_at_check" CHECK ("finished_at" IS NULL OR "finished_at" >= "started_at"),
  ADD CONSTRAINT "ingestion_runs_running_state_check" CHECK (("status" = 'RUNNING') = ("finished_at" IS NULL));

ALTER TABLE "source_health"
  ADD CONSTRAINT "source_health_http_status_check" CHECK ("last_http_status" IS NULL OR "last_http_status" BETWEEN 100 AND 599),
  ADD CONSTRAINT "source_health_errors_check" CHECK ("consecutive_errors" >= 0),
  ADD CONSTRAINT "source_health_timestamps_check" CHECK ("last_success_at" IS NULL OR "last_attempt_at" IS NULL OR "last_success_at" <= "last_attempt_at");

-- Supabase readiness: application tables are closed by default. Backend access uses
-- the direct PostgreSQL role; public policies are deliberately deferred.
ALTER TABLE "source_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "source_pages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "station_relations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "measurements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incident_signals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incident_signal_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "candidate_objects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "candidate_object_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "investigations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "investigation_measurements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "investigation_candidate_objects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidence_statements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidence_statement_measurements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidence_statement_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "investigation_unknowns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "replay_scenarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "replay_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ingestion_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "source_health" ENABLE ROW LEVEL SECURITY;
