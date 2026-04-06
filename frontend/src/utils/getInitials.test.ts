import { describe, it, expect } from 'vitest';
import { getInitials } from './getInitials';

describe('getInitials', () => {
  it('should return first two characters (uppercased) for a single word', () => {
    expect(getInitials('Alice')).toBe('AL');
  });

  it('should return first letter of each of the first two words', () => {
    expect(getInitials('Alice Bob')).toBe('AB');
  });

  it('should return default "XT" for empty string', () => {
    expect(getInitials('')).toBe('XT');
  });

  it('should return default "XT" for null', () => {
    expect(getInitials(null)).toBe('XT');
  });

  it('should return default "XT" for undefined', () => {
    expect(getInitials(undefined)).toBe('XT');
  });

  it('should uppercase the result', () => {
    expect(getInitials('alice bob')).toBe('AB');
  });

  it('should handle extra whitespace between words', () => {
    expect(getInitials('Alice   Bob')).toBe('AB');
  });
});
