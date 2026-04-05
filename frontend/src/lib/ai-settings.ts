import { AiConversationMessage, AiProvider, AiProviderSettings } from '../services/api-client';
import { getStoredAuthToken, parseAuthToken } from './auth';

export const aiSettingsStorageKey = 'x-thread-ai-settings';
export const aiConversationStorageKey = 'x-thread-ai-conversation';

export const aiProviderOptions: Array<{
  value: AiProvider;
  label: string;
  defaultModel: string;
  endpointLabel: string;
}> = [
  { value: 'deepseek', label: 'DeepSeek', defaultModel: 'deepseek-chat', endpointLabel: 'api.deepseek.com' },
  { value: 'kimi', label: 'Kimi', defaultModel: 'moonshot-v1-8k', endpointLabel: 'api.moonshot.cn/v1' },
  { value: 'qwen', label: 'Qwen', defaultModel: 'qwen-plus', endpointLabel: 'dashscope.aliyuncs.com/compatible-mode/v1' },
  { value: 'glm', label: 'GLM', defaultModel: 'glm-4-flash', endpointLabel: 'open.bigmodel.cn/api/paas/v4' },
  { value: 'modelscope', label: 'ModelScope', defaultModel: 'Qwen/Qwen2.5-72B-Instruct', endpointLabel: 'api-inference.modelscope.cn/v1' },
  {
    value: 'openai-compatible',
    label: 'OpenAI-Compatible',
    defaultModel: 'gpt-4.1-mini',
    endpointLabel: 'Custom OpenAI-compatible base URL',
  },
];

export const getAiProviderMeta = (provider: AiProvider) =>
  aiProviderOptions.find((item) => item.value === provider) ?? aiProviderOptions[0];

export const isCustomAiProvider = (provider: AiProvider) =>
  provider === 'openai-compatible';

export const normalizeAiBaseUrl = (baseUrl?: string | null) =>
  baseUrl?.trim().replace(/\/+$/, '') || '';

export const resolveAiEndpointLabel = (settings: AiProviderSettings) =>
  isCustomAiProvider(settings.provider)
    ? normalizeAiBaseUrl(settings.baseUrl) || 'Set a custom OpenAI-compatible base URL'
    : getAiProviderMeta(settings.provider).endpointLabel;

export const sanitizeAiSettings = (settings: AiProviderSettings): AiProviderSettings => {
  const provider = settings.provider;
  return {
    provider,
    apiKey: settings.apiKey ?? '',
    baseUrl: isCustomAiProvider(provider) ? normalizeAiBaseUrl(settings.baseUrl) : '',
    model: settings.model?.trim() || getAiProviderMeta(provider).defaultModel,
  };
};

export const getDefaultAiSettings = (): AiProviderSettings => ({
  provider: 'deepseek',
  apiKey: '',
  baseUrl: '',
  model: getAiProviderMeta('deepseek').defaultModel,
});

const getCurrentAiUserScope = () => {
  const token = getStoredAuthToken();
  if (!token) {
    return 'anonymous';
  }

  const parsed = parseAuthToken(token);
  return parsed?.sub?.trim() || token.slice(-12) || 'anonymous';
};

const normalizeRoomCode = (roomCode?: string) =>
  roomCode?.trim().toUpperCase() || 'global';

const getScopedAiSettingsStorageKey = () =>
  `${aiSettingsStorageKey}:${getCurrentAiUserScope()}`;

const getScopedAiConversationStorageKey = (roomCode?: string) =>
  `${aiConversationStorageKey}:${getCurrentAiUserScope()}:${normalizeRoomCode(roomCode)}`;

export const loadAiSettings = (): AiProviderSettings => {
  const saved = localStorage.getItem(getScopedAiSettingsStorageKey());
  if (!saved) {
    return getDefaultAiSettings();
  }

  try {
    const parsed = JSON.parse(saved) as Partial<AiProviderSettings>;
    const provider =
      parsed.provider && aiProviderOptions.some((item) => item.value === parsed.provider)
        ? parsed.provider
        : 'deepseek';

    return {
      provider,
      apiKey: parsed.apiKey ?? '',
      baseUrl: isCustomAiProvider(provider) ? normalizeAiBaseUrl(parsed.baseUrl) : '',
      model: parsed.model?.trim() || getAiProviderMeta(provider).defaultModel,
    };
  } catch {
    return getDefaultAiSettings();
  }
};

export const saveAiSettings = (settings: AiProviderSettings) => {
  const sanitized = sanitizeAiSettings(settings);
  localStorage.setItem(
    getScopedAiSettingsStorageKey(),
    JSON.stringify({
      provider: sanitized.provider,
      apiKey: sanitized.apiKey,
      baseUrl: sanitized.baseUrl,
      model: sanitized.model,
    } satisfies AiProviderSettings),
  );
};

export const loadAiConversation = (roomCode?: string): AiConversationMessage[] => {
  const saved = localStorage.getItem(getScopedAiConversationStorageKey(roomCode));
  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved) as Array<Partial<AiConversationMessage>>;
    return parsed
      .filter(
        (message): message is AiConversationMessage =>
          (message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string',
      )
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));
  } catch {
    return [];
  }
};

export const saveAiConversation = (
  roomCode: string | undefined,
  messages: AiConversationMessage[],
) => {
  localStorage.setItem(
    getScopedAiConversationStorageKey(roomCode),
    JSON.stringify(messages),
  );
};

export const clearAiConversation = (roomCode?: string) => {
  localStorage.removeItem(getScopedAiConversationStorageKey(roomCode));
};
