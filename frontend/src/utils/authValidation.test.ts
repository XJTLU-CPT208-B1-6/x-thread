import { describe, expect, it } from 'vitest';
import { getPasswordMatchError, getPasswordStrength, getStrengthLabel } from './authValidation';

describe('getPasswordMatchError', () => {
  it('returns empty string when confirm password is empty', () => {
    expect(getPasswordMatchError('en', 'abc', '')).toBe('');
  });

  it('returns english mismatch message', () => {
    expect(getPasswordMatchError('en', 'abc', 'abcd')).toBe('Passwords do not match');
  });

  it('returns chinese mismatch message', () => {
    expect(getPasswordMatchError('zh', 'abc', 'abcd')).toBe('两次输入的密码不一致');
  });

  it('returns empty when passwords match', () => {
    expect(getPasswordMatchError('zh', 'Abc123!!', 'Abc123!!')).toBe('');
  });
});

describe('password strength helpers', () => {
  it('classifies weak/medium/strong', () => {
    expect(getPasswordStrength('abc')).toBe('weak');
    expect(getPasswordStrength('abc12345')).toBe('medium');
    expect(getPasswordStrength('Abc12345!')).toBe('strong');
  });

  it('returns localized strength labels', () => {
    expect(getStrengthLabel('en', 'strong')).toBe('Strong');
    expect(getStrengthLabel('zh', 'medium')).toBe('中');
  });
});
