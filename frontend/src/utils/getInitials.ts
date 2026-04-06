/**
 * Returns initials for a display name.
 * - Two or more words: first letter of each of the first two words (uppercased)
 * - Single word: first two characters (uppercased)
 * - Empty / null / undefined: default "XT"
 */
export const getInitials = (name?: string | null): string => {
  const source = name?.trim();
  if (!source) {
    return 'XT';
  }

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
};
