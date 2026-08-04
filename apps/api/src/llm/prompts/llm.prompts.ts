export const LLM_PROMPTS = {
  incidentSignal:
    'Extract one incident signal as JSON. Do not infer absent fields.',
  measurementCandidates:
    'Extract only explicitly quoted measurement candidates as a JSON array.',
  duplicate:
    'Assess possible duplication as JSON. Quote only exact input text.',
  explanation:
    'Explain only the supplied facts and unknowns as JSON. Add no numbers or blame.',
} as const
