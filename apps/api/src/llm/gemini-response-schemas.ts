const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] } as const
const confidence = { type: 'number', minimum: 0, maximum: 1 } as const

export const GEMINI_RESPONSE_JSON_SCHEMAS = {
  incidentSignal: {
    type: 'object',
    properties: {
      observedAt: nullableString,
      observedPeriod: nullableString,
      locationText: { type: 'string' },
      phenomenon: {
        type: 'string',
        enum: [
          'oil_film',
          'color_change',
          'odor',
          'fish_kill',
          'wastewater',
          'other',
        ],
      },
      excerpt: { type: 'string' },
      evidenceQuotes: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 3,
      },
      confidence,
    },
    required: [
      'observedAt',
      'observedPeriod',
      'locationText',
      'phenomenon',
      'excerpt',
      'evidenceQuotes',
      'confidence',
    ],
    additionalProperties: false,
  },
  measurementCandidates: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        indicator: { type: 'string' },
        rawValueText: { type: 'string' },
        unit: { type: 'string' },
        evidenceQuote: { type: 'string' },
        confidence,
      },
      required: [
        'indicator',
        'rawValueText',
        'unit',
        'evidenceQuote',
        'confidence',
      ],
      additionalProperties: false,
    },
  },
  duplicate: {
    type: 'object',
    properties: {
      isDuplicate: { type: 'boolean' },
      confidence,
      rationale: { type: 'string' },
      evidenceQuotes: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 3,
      },
    },
    required: [
      'isDuplicate',
      'confidence',
      'rationale',
      'evidenceQuotes',
    ],
    additionalProperties: false,
  },
  explanation: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
    additionalProperties: false,
  },
} as const

export type GeminiResponseJsonSchema = Readonly<Record<string, unknown>>
