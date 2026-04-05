import { BadRequestException } from '@nestjs/common';

export const supportedAiProviders = [
  'deepseek',
  'kimi',
  'qwen',
  'glm',
  'modelscope',
  'openai-compatible',
] as const;

export type AiProvider = (typeof supportedAiProviders)[number];

export type ProviderConfig = {
  baseUrl: string;
  defaultModel: string;
  envKey?: string;
};

export const aiProviderConfigs: Record<AiProvider, ProviderConfig> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    envKey: 'DEEPSEEK_API_KEY',
  },
  kimi: {
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    envKey: 'KIMI_API_KEY',
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    envKey: 'QWEN_API_KEY',
  },
  glm: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    envKey: 'GLM_API_KEY',
  },
  modelscope: {
    baseUrl: 'https://api-inference.modelscope.cn/v1',
    defaultModel: 'Qwen/Qwen2.5-72B-Instruct',
    envKey: 'MODELSCOPE_API_KEY',
  },
  'openai-compatible': {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4.1-mini',
  },
};

export const defaultAiProvider: AiProvider = 'deepseek';

export const normalizeAiProvider = (provider?: string | null): AiProvider => {
  if (!provider) {
    return defaultAiProvider;
  }

  const normalized = provider.trim().toLowerCase();
  if (!supportedAiProviders.includes(normalized as AiProvider)) {
    throw new BadRequestException('Unsupported AI provider');
  }

  return normalized as AiProvider;
};

export const getDefaultAiModel = (provider: AiProvider) =>
  aiProviderConfigs[provider].defaultModel;

export const isCustomOpenAiProvider = (provider: AiProvider) =>
  provider === 'openai-compatible';

export const normalizeCustomBaseUrl = (baseUrl?: string | null) => {
  const trimmed = baseUrl?.trim();
  if (!trimmed) {
    throw new BadRequestException(
      'Base URL is required for the custom OpenAI-compatible provider',
    );
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('invalid protocol');
    }

    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    throw new BadRequestException(
      'Base URL must be a valid http(s) URL for the custom OpenAI-compatible provider',
    );
  }
};
