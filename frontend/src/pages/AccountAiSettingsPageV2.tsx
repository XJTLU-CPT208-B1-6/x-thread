import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { accountService, roomAiService, type AiProvider, type AiProviderSettings } from '../services/api-client';
import {
  aiProviderOptions,
  getAiProviderMeta,
  getDefaultAiSettings,
  isCustomAiProvider,
  resolveAiEndpointLabel,
  saveAiSettings,
  sanitizeAiSettings,
} from '../lib/ai-settings';

export default function AccountAiSettingsPageV2() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
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
          setError(err?.response?.data?.message ?? '加载 AI 配置失败');
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
      setError('自定义 OpenAI-compatible 供应商需要填写 Base URL');
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
      setSavedNotice('已保存到当前账号，后续登录会自动恢复这组 AI 配置。');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? '保存 AI 配置失败');
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
          : '当前供应商返回了 0 个模型。',
      );
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? '拉取模型失败');
    } finally {
      setFetchingModels(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(12,74,110,0.2),_transparent_28%),linear-gradient(135deg,_#04121c_0%,_#0f3b53_38%,_#f3efe5_100%)] px-4 py-8">
      <div className="mx-auto max-w-5xl rounded-[32px] border border-white/20 bg-white/90 shadow-[0_24px_80px_rgba(2,12,27,0.22)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-8 py-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Account AI Settings</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">账号级 AI 配置</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
              为当前账号保存 API Key、模型和供应商。你也可以添加一个自定义 OpenAI-compatible 接口，并直接拉取模型列表。
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(code ? `/room/${code}/discuss` : '/')}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            返回
          </button>
        </div>

        <div className="grid gap-6 px-8 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            {loading ? (
              <div className="rounded-3xl border border-dashed border-slate-200 px-5 py-8 text-center text-sm text-slate-500">
                正在加载账号绑定的 AI 配置...
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">供应商</label>
                  <select
                    value={settings.provider}
                    onChange={(event) => handleProviderChange(event.target.value as AiProvider)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
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
                    <label className="mb-2 block text-sm font-medium text-slate-700">Base URL</label>
                    <input
                      value={settings.baseUrl ?? ''}
                      onChange={(event) => updateSettings({ baseUrl: event.target.value })}
                      placeholder="https://your-openai-compatible-endpoint/v1"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">API Key</label>
                  <input
                    type="password"
                    value={settings.apiKey}
                    onChange={(event) => updateSettings({ apiKey: event.target.value })}
                    placeholder="输入当前供应商 API Key"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-0 flex-1">
                      <label className="mb-2 block text-sm font-medium text-slate-700">模型</label>
                      <input
                        value={settings.model ?? ''}
                        onChange={(event) => updateSettings({ model: event.target.value })}
                        placeholder={providerMeta.defaultModel}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleFetchModels()}
                      disabled={fetchingModels}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {fetchingModels ? '拉取中...' : '拉取模型'}
                    </button>
                  </div>

                  {availableModels.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Available Models</div>
                      <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                        {availableModels.map((model) => (
                          <button
                            key={model}
                            type="button"
                            onClick={() => updateSettings({ model })}
                            className={`rounded-full border px-3 py-1.5 text-xs transition ${
                              (settings.model ?? '').trim() === model
                                ? 'border-sky-300 bg-sky-100 text-sky-700'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
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
                    className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? '保存中...' : '保存到账号'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleTestConnection()}
                    disabled={testing}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {testing ? '测试中...' : '测试连接'}
                  </button>
                </div>
              </>
            )}

            {savedNotice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{savedNotice}</div>}
            {testMessage && <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">{testMessage}</div>}
            {modelsNotice && <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">{modelsNotice}</div>}
            {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-800">当前状态</div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Provider</div>
                <div className="mt-1 font-medium text-slate-900">{providerMeta.label}</div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Default Model</div>
                <div className="mt-1 font-medium text-slate-900">{providerMeta.defaultModel}</div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Current Model</div>
                <div className="mt-1 break-all font-medium text-slate-900">{normalizedSettings.model}</div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Endpoint</div>
                <div className="mt-1 break-all text-slate-900">{endpointLabel}</div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">API Key</div>
                <div className="mt-1 text-slate-900">{settings.apiKey.trim() ? '已填写并会随账号恢复' : '尚未填写'}</div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Fetched Models</div>
                <div className="mt-1 text-slate-900">{availableModels.length > 0 ? `${availableModels.length} 个` : '尚未拉取'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
