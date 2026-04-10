export type PersonalityType = 'I' | 'E';
export type PersonalityCopyLanguage = 'zh' | 'en';

export const getPersonalityTypeOptions = (
  language: PersonalityCopyLanguage = 'zh',
): Array<{
  value: PersonalityType;
  label: string;
  description: string;
}> =>
  language === 'en'
    ? [
        {
          value: 'I',
          label: 'Introvert',
          description: 'Usually quieter and more likely to think before speaking.',
        },
        {
          value: 'E',
          label: 'Extrovert',
          description: 'Usually more outgoing and more likely to organize ideas while talking.',
        },
      ]
    : [
        {
          value: 'I',
          label: 'I人',
          description: '偏安静，通常会先想一想再表达。',
        },
        {
          value: 'E',
          label: 'E人',
          description: '偏外向，通常会边聊边整理想法。',
        },
      ];

export const personalityTypeOptions = getPersonalityTypeOptions('zh');

export const getPersonalityTypeLabel = (
  value?: PersonalityType | null,
  language: PersonalityCopyLanguage = 'zh',
) => {
  if (value === 'I') {
    return language === 'en' ? 'Introvert' : 'I人';
  }

  if (value === 'E') {
    return language === 'en' ? 'Extrovert' : 'E人';
  }

  return '';
};
