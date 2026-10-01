/** Extra sample parameter sets in one booking live under this key of `input_values`. */
export const SAMPLE_SETS_KEY = "_sample_sets";
/** Additional sets on top of sample set 1 (matches the backend limit). */
export const MAX_SAMPLE_SETS = 20;

export type SampleSetValues = Record<string, string | boolean | string[] | number>;

export function readSampleSets(inputValues: Record<string, unknown> | null | undefined): SampleSetValues[] {
  const raw = inputValues?.[SAMPLE_SETS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is SampleSetValues => !!s && typeof s === "object" && !Array.isArray(s));
}

export function withoutSampleSets<T extends Record<string, unknown>>(inputValues: T): T {
  if (!inputValues || !(SAMPLE_SETS_KEY in inputValues)) return inputValues;
  const { [SAMPLE_SETS_KEY]: _omit, ...rest } = inputValues;
  void _omit;
  return rest as T;
}

export function withSampleSets<T extends Record<string, unknown>>(
  inputValues: T,
  sets: SampleSetValues[],
): T & { [SAMPLE_SETS_KEY]?: SampleSetValues[] } {
  const base = withoutSampleSets(inputValues);
  return sets.length > 0 ? { ...base, [SAMPLE_SETS_KEY]: sets } : base;
}
