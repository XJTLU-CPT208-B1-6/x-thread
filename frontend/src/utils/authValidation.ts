export type AppLanguage = 'zh' | 'en';
export type PasswordStrengthLevel = 'weak' | 'medium' | 'strong';

export const getPasswordMatchError = (
  language: AppLanguage,
  password: string,
  confirmPassword: string,
): string => {
  if (!confirmPassword) return '';
  return password === confirmPassword
    ? ''
    : language === 'zh'
      ? '两次输入的密码不一致'
      : 'Passwords do not match';
};

export const getPasswordStrength = (password: string): PasswordStrengthLevel => {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score >= 4) return 'strong';
  if (score >= 2) return 'medium';
  return 'weak';
};

export const getStrengthLabel = (language: AppLanguage, level: PasswordStrengthLevel): string => {
  if (language === 'zh') {
    if (level === 'strong') return '强';
    if (level === 'medium') return '中';
    return '弱';
  }
  if (level === 'strong') return 'Strong';
  if (level === 'medium') return 'Medium';
  return 'Weak';
};
