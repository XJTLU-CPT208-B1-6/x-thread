import { describe, expect, it } from 'vitest';
import { BASE_ROOM_TAGS, MAX_TAG_LENGTH, sanitizeCustomTag, validateCustomTag } from './roomTags';

describe('room tags', () => {
  it('sanitizes extra spaces', () => {
    expect(sanitizeCustomTag('  AI   Lab  ')).toBe('AI Lab');
  });

  it('validates empty tag', () => {
    expect(validateCustomTag('', BASE_ROOM_TAGS, 'en')).toBe('Please enter a tag name');
  });

  it('validates duplicate tag case-insensitively', () => {
    expect(validateCustomTag('study', BASE_ROOM_TAGS, 'en')).toBe('Tag already exists');
  });

  it('validates max length', () => {
    expect(validateCustomTag('a'.repeat(MAX_TAG_LENGTH + 1), BASE_ROOM_TAGS, 'zh')).toContain('不能超过');
  });

  it('validates character set', () => {
    expect(validateCustomTag('tag@!', BASE_ROOM_TAGS, 'en')).toContain('Only letters');
  });

  it('returns empty for valid custom tag', () => {
    expect(validateCustomTag('Exam Prep', BASE_ROOM_TAGS, 'en')).toBe('');
  });
});
