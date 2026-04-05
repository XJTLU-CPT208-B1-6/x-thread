import { useEffect, useMemo, useState } from 'react';
import {
  accountService,
  roomAiService,
  type AiProvider,
  type AiProviderSettings,
} from '../services/api-client';
import {
  aiProviderOptions,
  getAiProviderMeta,
  getDefaultAiSettings,
  isCustomAiProvider,
  resolveAiEndpointLabel,
  saveAiSettings,
  sanitizeAiSettings,
} from '../lib/ai-settings';

type AccountAiSettingsPanelProps = {
  onSaved?: (settings: AiProviderSettings) => void;
};

export const AccountAiSettingsPanel = ({ onSaved }: AccountAiSettingsPanelProps) => {
  const [settings, setSettings] = useState<AiProviderSettings>(getDefaultAiSettings);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [modelsNotice, setModelsNotice] = useState('');
  const [error, setError] = useState('');

  const providerMeta = useMemo(() => getAiProviderMeta(settings.provider), [settings.provider]);
  const endpointLabel = useMemo(() => resolveAiEndpointLabel(settings), [settings]);
  const normalizedSettings = useMemo(() => sanitizeAiSettings(settings), [settings]);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      setLoading(true);
      setError('');

      try {
        const result = await accountService.getAiSettings();
        if (!cancelled) {
          setSettings(result);
          saveAiSettings(result);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.message ?? '加载 AI 设置失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = (patch: Partial<AiProviderSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    setSavedNotice('');
    setTestMessage('');
    setModelsNotice('');
    setError('');
  };

  const handleProviderChange = (provider: AiProvider) => {
    updateSettings({
      provider,
      model: getAiProviderMeta(provider).defaultModel,
      baseUrl: isCustomAiProvider(provider) ? settings.baseUrl ?? '' : '',
    });
    setAvailableModels([]);
  };

  const ensureProviderReady = (requireModel = false) => {
    if (!settings.apiKey.trim()) {
      setError('请先输入 API Key');
      return false;
    }

    if (isCustomAiProvider(settings.provider) && !settings.baseUrl?.trim()) {
      setError('自定义 OpenAI-Compatible 提供商需要填写 Base URL');
      return false;
    }

    if (requireModel && !normalizedSettings.model?.trim()) {
      setError('请先填写模型名称');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (isCustomAiProvider(settings.provider) && !ensureProviderReady()) {
      return;
    }

    setSaving(true);
    setSavedNotice('');
    setError('');

    try {
      const result = await accountService.updateAiSettings(normalizedSettings);
      setSettings(result.settings);
      saveAiSettings(result.settings);
      setSavedNotice('已保存到当前账号，后续登录会自动恢复这组 AI 设置。');
      onSaved?.(result.settings);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? '保存 AI 设置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!ensureProviderReady(true)) {
      return;
    }

    setTesting(true);
    setError('');
    setTestMessage('');

    try {
      const response = await roomAiService.testConnection(normalizedSettings);
      setTestMessage(`${response.provider} / ${response.model}: ${response.message}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? '连接测试失败');
    } finally {
      setTesting(false);
    }
  };

  const handleFetchModels = async () => {
    if (!ensureProviderReady()) {
      return;
    }

    setFetchingModels(true);
    setError('');
    setModelsNotice('');

    try {
      const response = await roomAiService.fetchModels(normalizedSettings);
      setAvailableModels(response.models);
      setModelsNotice(
        response.models.length > 0
          ? `已拉取 ${response.models.length} 个模型，可点击下方模型名快速填入。`
          : '当前提供商返回了 0 个模型。',
      );
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? '拉取模型失败');
    } finally {
      setFetchingModels(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        {loading ? (
          <div className="rounded-3xl border border-dashed border-blue-200 px-5 py-8 text-center text-sm text-blue-500">
            正在加载当前账号绑定的 AI 设置...
          </div>
        ) : (
          <>
            <div>
              <label className="mb-2 block text-sm font-medium text-blue-950">提供商</label>
              <select
                value={settings.provider}
                onChange={(event) => handleProviderChange(event.target.value as AiProvider)}
                className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm text-blue-950 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
              >
                {aiProviderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {isCustomAiProvider(settings.provider) && (
              <div>
                <label className="mb-2 block text-sm font-medium text-blue-950">Base URL</label>
                <input
                  value={settings.baseUrl ?? ''}
                  onChange={(event) => updateSettings({ baseUrl: event.target.value })}
                  placeholder="https://your-openai-compatible-endpoint/v1"
                  className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm text-blue-950 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-blue-950">API Key</label>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(event) => updateSettings({ apiKey: event.target.value })}
                placeholder="输入当前提供商的 API Key"
                className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm text-blue-950 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
              />
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                  <label className="mb-2 block text-sm font-medium text-blue-950">模型</label>
                  <input
                    value={settings.model ?? ''}
                    onChange={(event) => updateSettings({ model: event.target.value })}
                    placeholder={providerMeta.defaultModel}
                    className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm text-blue-950 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleFetchModels()}
                  disabled={fetchingModels}
                  className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {fetchingModels ? '拉取中...' : '拉取模型'}
                </button>
              </div>

              {availableModels.length > 0 && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-purple-500">
                    Available Models
                  </div>
                  <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                    {availableModels.map((model) => (
                      <button
                        key={model}
                        type="button"
                        onClick={() => updateSettings({ model })}
                        className={`rounded-full border px-3 py-1.5 text-xs transition ${
                          (settings.model ?? '').trim() === model
                            ? 'border-purple-300 bg-purple-100 text-purple-700'
                            : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-2xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? '保存中...' : '保存到账号'}
              </button>
              <button
                type="button"
                onClick={() => void handleTestConnection()}
                disabled={testing}
                className="rounded-2xl border border-blue-200 bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testing ? '测试中...' : '测试连接'}
              </button>
            </div>
          </>
        )}

        {savedNotice && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {savedNotice}
          </div>
        )}
        {testMessage && (
          <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-700">
            {testMessage}
          </div>
        )}
        {modelsNotice && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
            {modelsNotice}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
      </div>

      <div className="rounded-[28px] border border-blue-100 bg-blue-50/50 p-5">
        <div className="text-sm font-semibold text-blue-950">当前状态</div>
        <div className="mt-4 space-y-3 text-sm text-blue-800/80">
          <div className="rounded-2xl bg-white px-4 py-3 border border-blue-100/50 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-blue-500">Provider</div>
            <div className="mt-1 font-medium text-blue-950">{providerMeta.label}</div>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 border border-blue-100/50 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-blue-500">Default Model</div>
            <div className="mt-1 font-medium text-blue-950">{providerMeta.defaultModel}</div>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 border border-blue-100/50 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-blue-500">Current Model</div>
            <div className="mt-1 break-all font-medium text-blue-950">{normalizedSettings.model}</div>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 border border-blue-100/50 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-blue-500">Endpoint</div>
            <div className="mt-1 break-all text-blue-950">{endpointLabel}</div>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 border border-blue-100/50 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-blue-500">API Key</div>
            <div className="mt-1 text-blue-950">
              {settings.apiKey.trim() ? '已填写并会随账号恢复' : '尚未填写'}
            </div>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 border border-blue-100/50 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-blue-500">Fetched Models</div>
            <div className="mt-1 text-blue-950">
              {availableModels.length > 0 ? `${availableModels.length} 个` : '尚未拉取'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
