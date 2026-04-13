export const BASE_ROOM_TAGS = ['Study', 'Casual', 'Deadline', 'Brainstorm', 'Support', 'Project'];

const TAG_NAME_PATTERN = /^[A-Za-z0-9\u4e00-\u9fa5 _-]+$/;
export const MAX_TAG_LENGTH = 20;

export const sanitizeCustomTag = (value: string) => value.trim().replace(/\s+/g, ' ');

export const validateCustomTag = (
  rawValue: string,
  existingTags: string[],
  language: 'zh' | 'en',
): string => {
  const value = sanitizeCustomTag(rawValue);
  if (!value) return language === 'zh' ? '请输入标签名称' : 'Please enter a tag name';
  if (value.length > MAX_TAG_LENGTH) {
    return language === 'zh'
      ? `标签长度不能超过 ${MAX_TAG_LENGTH} 个字符`
      : `Tag name must be ${MAX_TAG_LENGTH} characters or fewer`;
  }
  if (!TAG_NAME_PATTERN.test(value)) {
    return language === 'zh'
      ? '标签仅支持中英文、数字、空格、下划线和连字符'
      : 'Only letters, numbers, spaces, underscores and hyphens are allowed';
  }
  if (existingTags.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
    return language === 'zh' ? '标签已存在' : 'Tag already exists';
  }
  return '';
};
