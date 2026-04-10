export const personalityTypeValues = ['I', 'E'] as const;

export type PersonalityTypeValue = (typeof personalityTypeValues)[number];

export const normalizePersonalityType = (value: unknown): PersonalityTypeValue | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === 'I' || normalized === 'E') {
    return normalized;
  }

  return null;
};
