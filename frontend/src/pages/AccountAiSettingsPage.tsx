export { default } from './AccountAiSettingsPageV2';
/*
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { accountService, AiProvider, AiProviderSettings, roomAiService } from '../services/api-client';
import {
  aiProviderOptions,
  getAiProviderMeta,
  getDefaultAiSettings,
  isCustomAiProvider,
  resolveAiEndpointLabel,
  saveAiSettings,
  sanitizeAiSettings,
} from '../lib/ai-settings';

export default function AccountAiSettingsPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const [settings, setSettings] = useState<AiProviderSettings>(getDefaultAiSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [modelsNotice, setModelsNotice] = useState('');
  const [error, setError] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const providerMeta = useMemo(() => getAiProviderMeta(settings.provider), [settings.provider]);
  const providerEndpoint = useMemo(() => resolveAiEndpointLabel(settings), [settings]);

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
    setError('');
    setTestMessage('');
    setModelsNotice('');
  };

  const handleProviderChange = (provider: AiProvider) => {
    updateSettings({
      provider,
      model: getAiProviderMeta(provider).defaultModel,
      baseUrl: isCustomAiProvider(provider) ? settings.baseUrl ?? '' : '',
    });
    setAvailableModels([]);
  };

  const ensureProviderReady = () => {
    if (!ensureProviderReady()) {
      setError('请先输入 API Key');
      return false;
    }

    if (isCustomAiProvider(settings.provider) && !settings.baseUrl?.trim()) {
      setError('自定义 OpenAI-compatible 供应商需要填写 Base URL');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSavedNotice('');
    try {
      const result = await accountService.updateAiSettings(
        sanitizeAiSettings({
          provider: settings.provider,
          apiKey: settings.apiKey.trim(),
          baseUrl: settings.baseUrl,
          model: settings.model?.trim() || providerMeta.defaultModel,
        }),
      );
      setSettings(result.settings);
      saveAiSettings(result.settings);
      setSavedNotice('已保存到当前账号，后续登录会自动恢复这组 AI 配置');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? '保存 AI 配置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!settings.apiKey.trim()) {
      setError('请先输入 API Key');
      return;
    }

    setTesting(true);
    setError('');
    setTestMessage('');
    try {
      const response = await roomAiService.testConnection({
        provider: settings.provider,
        apiKey: settings.apiKey.trim(),
        model: settings.model?.trim() || providerMeta.defaultModel,
      });
      setTestMessage(`${response.provider} / ${response.model}: ${response.message}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? '连接测试失败');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,_#03131f_0%,_#11324a_40%,_#f3efe5_100%)] px-4 py-8">
      <div className="mx-auto max-w-5xl rounded-[32px] border border-white/20 bg-white/90 shadow-[0_24px_80px_rgba(2,12,27,0.22)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-8 py-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Account Bound AI Settings</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">账号级 AI 配置</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
              这里保存的是跟个人账号绑定的 AI 设置。登录后会自动恢复到当前浏览器，并供房间问答、脑图生成和优化直接使用。
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
                  <label className="mb-2 block text-sm font-medium text-slate-700">平台</label>
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

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">API Key</label>
                  <input
                    type="password"
                    value={settings.apiKey}
                    onChange={(event) => updateSettings({ apiKey: event.target.value })}
                    placeholder="输入当前平台 API Key"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">模型</label>
                  <input
                    value={settings.model ?? ''}
                    onChange={(event) => updateSettings({ model: event.target.value })}
                    placeholder={providerMeta.defaultModel}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  />
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
                    disabled={testing || !settings.apiKey.trim()}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                {testMessage}
              </div>
            )}
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-800">当前状态</div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">平台</div>
                <div className="mt-1 font-medium text-slate-900">{providerMeta.label}</div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">默认模型</div>
                <div className="mt-1 font-medium text-slate-900">{providerMeta.defaultModel}</div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">当前模型</div>
                <div className="mt-1 break-all font-medium text-slate-900">
                  {settings.model?.trim() || providerMeta.defaultModel}
                </div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">接口地址</div>
                <div className="mt-1 break-all text-slate-900">{providerMeta.endpointLabel}</div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">API Key</div>
                <div className="mt-1 text-slate-900">
                  {settings.apiKey.trim() ? '已填写并会随账号恢复' : '尚未填写'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
*/
