// ТЗ §8, таблица `evidence_statements`.
export type EvidenceStatement = {
  id: string
  kind: "supports" | "contradicts" | "limits" | "unknown"
  text: string
  measurementIds: string[]
  sourceDocumentIds: string[]
  generatedBy: "rule_engine" | "human_verified"
}
