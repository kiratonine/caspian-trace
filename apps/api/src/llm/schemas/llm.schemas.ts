import { z } from 'zod'

const quote = z.string().trim().min(1)

export const ExtractedSignalSchema = z.object({
  observedAt: z.string().datetime({ offset: true }).nullable(),
  observedPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable(),
  locationText: z.string().trim().min(1),
  phenomenon: z.enum([
    'oil_film',
    'color_change',
    'odor',
    'fish_kill',
    'wastewater',
    'other',
  ]),
  excerpt: z.string().trim().min(1),
  evidenceQuotes: z.array(quote).min(1).max(3),
  confidence: z.number().min(0).max(1),
}).strict()

export const MeasurementCandidateSchema = z.object({
  indicator: z.string().trim().min(1),
  rawValueText: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  evidenceQuote: quote,
  confidence: z.number().min(0).max(1),
}).strict()

export const MeasurementCandidatesSchema = z.array(MeasurementCandidateSchema)

export const DuplicateAssessmentSchema = z.object({
  isDuplicate: z.boolean(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().min(1),
  evidenceQuotes: z.array(quote).max(3),
}).strict().refine(
  ({ isDuplicate, evidenceQuotes }) => !isDuplicate || evidenceQuotes.length > 0,
  { message: 'A duplicate decision requires at least one evidence quote' },
)

export const GeneratedExplanationSchema = z.object({
  text: z.string().trim().min(1),
}).strict()

export type ExtractedSignal = z.infer<typeof ExtractedSignalSchema>
export type MeasurementCandidate = z.infer<typeof MeasurementCandidateSchema>
export type DuplicateAssessment = z.infer<typeof DuplicateAssessmentSchema>
export type GeneratedExplanation = z.infer<typeof GeneratedExplanationSchema>
