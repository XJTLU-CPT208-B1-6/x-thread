export const parseBooleanFlag = (value?: string | boolean | null) =>
  value === true || value === 'true' || value === '1';

export const parseOptionalInt = (
  value: string | number | undefined,
  fallback: number,
  options?: { min?: number; max?: number },
) => {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const min = options?.min ?? Number.MIN_SAFE_INTEGER;
  const max = options?.max ?? Number.MAX_SAFE_INTEGER;

  return Math.min(max, Math.max(min, parsed));
};

export const parseOptionalDate = (value?: string | null) => {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};
