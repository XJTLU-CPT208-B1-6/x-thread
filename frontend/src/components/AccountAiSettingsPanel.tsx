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
import { useLanguageStore } from '../stores/useLanguageStore';

type AccountAiSettingsPanelProps = {
  onSaved?: (settings: AiProviderSettings) => void;
};

export const AccountAiSettingsPanel = ({ onSaved }: AccountAiSettingsPanelProps) => {
  const { language } = useLanguageStore();
  const copy = useMemo(
    () =>
      language === 'en'
        ? {
            loadFailed: 'Failed to load AI settings',
            apiKeyRequired: 'Enter an API key first',
            baseUrlRequired: 'Custom OpenAI-compatible providers require a Base URL',
            modelRequired: 'Enter a model name first',
            saveSuccess: 'Saved to your account. These AI settings will restore automatically next time.',
            saveFailed: 'Failed to save AI settings',
            testFailed: 'Connection test failed',
            modelsLoaded: (count: number) => `Loaded ${count} models. Click one below to fill it quickly.`,
            noModels: 'The provider returned 0 models.',
            fetchFailed: 'Failed to fetch models',
            loading: 'Loading account AI settings...',
            provider: 'Provider',
            apiKey: 'API Key',
            model: 'Model',
            fetchModels: 'Fetch Models',
            fetchingModels: 'Fetching...',
            save: 'Save to Account',
            saving: 'Saving...',
            test: 'Test Connection',
            testing: 'Testing...',
            status: 'Current Status',
            endpoint: 'Endpoint',
            currentModel: 'Current Model',
            defaultModel: 'Default Model',
            fetchedModels: 'Fetched Models',
            apiKeyFilled: 'Stored and restorable with your account',
            apiKeyEmpty: 'Not filled in yet',
            notFetched: 'Not fetched yet',
            baseUrl: 'Base URL',
            apiKeyPlaceholder: 'Enter the provider API key',
          }
        : {
            loadFailed: '加载 AI 设置失败',
            apiKeyRequired: '请先输入 API Key',
            baseUrlRequired: '自定义 OpenAI-compatible 供应商需要填写 Base URL',
            modelRequired: '请先填写模型名称',
            saveSuccess: '已保存到当前账号，后续登录会自动恢复这组 AI 设置。',
            saveFailed: '保存 AI 设置失败',
            testFailed: '连接测试失败',
            modelsLoaded: (count: number) => `已拉取 ${count} 个模型，可点击下方模型名快速填入。`,
            noModels: '当前供应商返回了 0 个模型。',
            fetchFailed: '拉取模型失败',
            loading: '正在加载当前账号绑定的 AI 设置...',
            provider: '提供商',
            apiKey: 'API Key',
            model: '模型',
            fetchModels: '拉取模型',
            fetchingModels: '拉取中...',
            save: '保存到账号',
            saving: '保存中...',
            test: '测试连接',
            testing: '测试中...',
            status: '当前状态',
            endpoint: '接口地址',
            currentModel: '当前模型',
            defaultModel: '默认模型',
            fetchedModels: '已拉取模型',
            apiKeyFilled: '已填写并会随账号恢复',
            apiKeyEmpty: '尚未填写',
            notFetched: '尚未拉取',
            baseUrl: 'Base URL',
            apiKeyPlaceholder: '输入当前供应商的 API Key',
          },
    [language],
  );

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
          setError(err?.response?.data?.message ?? copy.loadFailed);
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
  }, [copy.loadFailed]);

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
      setError(copy.apiKeyRequired);
      return false;
    }
    if (isCustomAiProvider(settings.provider) && !settings.baseUrl?.trim()) {
      setError(copy.baseUrlRequired);
      return false;
    }
    if (requireModel && !normalizedSettings.model?.trim()) {
      setError(copy.modelRequired);
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
      setSavedNotice(copy.saveSuccess);
      onSaved?.(result.settings);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? copy.saveFailed);
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
      setError(err?.response?.data?.message ?? err?.message ?? copy.testFailed);
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
      setModelsNotice(response.models.length > 0 ? copy.modelsLoaded(response.models.length) : copy.noModels);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? copy.fetchFailed);
    } finally {
      setFetchingModels(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        {loading ? (
          <div className="rounded-3xl border border-dashed border-blue-200 px-5 py-8 text-center text-sm text-blue-500">
            {copy.loading}
          </div>
        ) : (
          <>
            <div>
              <label className="mb-2 block text-sm font-medium text-blue-950">{copy.provider}</label>
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

            {isCustomAiProvider(settings.provider) ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-blue-950">{copy.baseUrl}</label>
                <input
                  value={settings.baseUrl ?? ''}
                  onChange={(event) => updateSettings({ baseUrl: event.target.value })}
                  placeholder="https://your-openai-compatible-endpoint/v1"
                  className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm text-blue-950 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
                />
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-sm font-medium text-blue-950">{copy.apiKey}</label>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(event) => updateSettings({ apiKey: event.target.value })}
                placeholder={copy.apiKeyPlaceholder}
                className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm text-blue-950 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
              />
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                  <label className="mb-2 block text-sm font-medium text-blue-950">{copy.model}</label>
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
                  {fetchingModels ? copy.fetchingModels : copy.fetchModels}
                </button>
              </div>

              {availableModels.length > 0 ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-purple-500">Available Models</div>
                  <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                    {availableModels.map((model) => (
                      <button
                        key={model}
                        type="button"
                        onClick={() => updateSettings({ model })}
                        className={`rounded-full border px-3 py-1.5 text-xs transition ${(settings.model ?? '').trim() === model ? 'border-purple-300 bg-purple-100 text-purple-700' : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-100'}`}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void handleSave()} disabled={saving} className="rounded-2xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? copy.saving : copy.save}
              </button>
              <button type="button" onClick={() => void handleTestConnection()} disabled={testing} className="rounded-2xl border border-blue-200 bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60">
                {testing ? copy.testing : copy.test}
              </button>
            </div>
          </>
        )}

        {savedNotice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{savedNotice}</div> : null}
        {testMessage ? <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-700">{testMessage}</div> : null}
        {modelsNotice ? <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">{modelsNotice}</div> : null}
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      </div>

      <div className="rounded-[28px] border border-blue-100 bg-blue-50/50 p-5">
        <div className="text-sm font-semibold text-blue-950">{copy.status}</div>
        <div className="mt-4 space-y-3 text-sm text-blue-800/80">
          <div className="rounded-2xl bg-white px-4 py-3 border border-blue-100/50 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-blue-500">Provider</div>
            <div className="mt-1 font-medium text-blue-950">{providerMeta.label}</div>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 border border-blue-100/50 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-blue-500">{copy.defaultModel}</div>
            <div className="mt-1 font-medium text-blue-950">{providerMeta.defaultModel}</div>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 border border-blue-100/50 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-blue-500">{copy.currentModel}</div>
            <div className="mt-1 break-all font-medium text-blue-950">{normalizedSettings.model}</div>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 border border-blue-100/50 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-blue-500">{copy.endpoint}</div>
            <div className="mt-1 break-all text-blue-950">{endpointLabel}</div>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 border border-blue-100/50 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-blue-500">{copy.apiKey}</div>
            <div className="mt-1 text-blue-950">{settings.apiKey.trim() ? copy.apiKeyFilled : copy.apiKeyEmpty}</div>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 border border-blue-100/50 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-blue-500">{copy.fetchedModels}</div>
            <div className="mt-1 text-blue-950">{availableModels.length > 0 ? `${availableModels.length}` : copy.notFetched}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

