export { default } from './AccountAiSettingsPageV2';
/*
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  aiProviderOptions,
  getAiProviderMeta,
  loadAiSettings,
  saveAiSettings,
} from '../lib/ai-settings';
import { roomAiService, AiProvider, AiProviderSettings } from '../services/api-client';

export default function AiSettingsPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const [settings, setSettings] = useState<AiProviderSettings>(() => loadAiSettings());
  const [savedNotice, setSavedNotice] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

  const providerMeta = useMemo(() => getAiProviderMeta(settings.provider), [settings.provider]);

  const updateSettings = (patch: Partial<AiProviderSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    setSavedNotice('');
    setError('');
    setTestMessage('');
  };

  const handleProviderChange = (provider: AiProvider) => {
    updateSettings({
      provider,
      model: getAiProviderMeta(provider).defaultModel,
    });
  };

  const handleSave = () => {
    saveAiSettings({
      provider: settings.provider,
      apiKey: settings.apiKey.trim(),
      model: settings.model?.trim() || providerMeta.defaultModel,
    });
    setSavedNotice('\u5df2\u4fdd\u5b58\u5230\u5f53\u524d\u7528\u6237\u7684 AI \u914d\u7f6e');
  };

  const handleTestConnection = async () => {
    if (!settings.apiKey.trim()) {
      setError('\u8bf7\u5148\u586b\u5199 API Key');
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
      setError(err?.response?.data?.message ?? err?.message ?? 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-4xl rounded-[28px] border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-8 py-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">AI Settings</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">{'\u667a\u80fd\u5e73\u53f0\u914d\u7f6e'}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {'\u9009\u62e9\u5f53\u524d AI \u5e73\u53f0\uff0c\u7ba1\u7406 API Key\uff0c\u5e76\u5728\u6b64\u9875\u6d4b\u8bd5\u8fde\u901a\u6027\u3002\u6bcf\u4e2a\u6210\u5458\u7684\u914d\u7f6e\u5355\u72ec\u4fdd\u5b58\uff0c\u4e92\u4e0d\u5f71\u54cd\u3002'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(code ? `/room/${code}/discuss` : '/')}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            {'\u8fd4\u56de\u95ee\u7b54'}
          </button>
        </div>

        <div className="grid gap-6 px-8 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{'\u5e73\u53f0'}</label>
              <select
                value={settings.provider}
                onChange={(event) => handleProviderChange(event.target.value as AiProvider)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              >
                {aiProviderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{'API Key'}</label>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(event) => updateSettings({ apiKey: event.target.value })}
                placeholder={'\u8f93\u5165\u5f53\u524d\u5e73\u53f0 API Key'}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{'\u6a21\u578b'}</label>
              <input
                value={settings.model ?? ''}
                onChange={(event) => updateSettings({ model: event.target.value })}
                placeholder={providerMeta.defaultModel}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                {'\u4fdd\u5b58\u8bbe\u7f6e'}
              </button>
              <button
                type="button"
                onClick={() => void handleTestConnection()}
                disabled={testing || !settings.apiKey.trim()}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {testing ? '\u6d4b\u8bd5\u4e2d...' : '\u6d4b\u8bd5\u8fde\u63a5'}
              </button>
            </div>

            {savedNotice && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {savedNotice}
              </div>
            )}

            {testMessage && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {testMessage}
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-800">{'\u5f53\u524d\u914d\u7f6e'}</div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{'\u5e73\u53f0'}</div>
                <div className="mt-1 font-medium text-slate-900">{providerMeta.label}</div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{'\u9ed8\u8ba4\u6a21\u578b'}</div>
                <div className="mt-1 font-medium text-slate-900">{providerMeta.defaultModel}</div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{'\u5f53\u524d\u6a21\u578b'}</div>
                <div className="mt-1 font-medium break-all text-slate-900">
                  {settings.model?.trim() || providerMeta.defaultModel}
                </div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{'\u63a5\u53e3\u57fa\u5730'}</div>
                <div className="mt-1 break-all text-slate-900">{providerMeta.endpointLabel}</div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{'API Key'}</div>
                <div className="mt-1 text-slate-900">
                  {settings.apiKey.trim() ? '\u5df2\u586b\u5199' : '\u672a\u586b\u5199'}
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
