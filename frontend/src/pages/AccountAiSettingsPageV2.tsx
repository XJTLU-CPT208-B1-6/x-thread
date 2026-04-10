import { useNavigate } from 'react-router-dom';
import { AccountAiSettingsPanel } from '../components/AccountAiSettingsPanel';
import { useLanguageStore } from '../stores/useLanguageStore';

export default function AccountAiSettingsPageV2() {
  const navigate = useNavigate();
  const { language } = useLanguageStore();
  const copy = language === 'en'
    ? {
        title: 'Account AI Settings',
        desc: 'Save the provider, model, and API key used by your account. These settings restore automatically after sign-in.',
        back: 'Back',
      }
    : {
        title: '账号级 AI 设置',
        desc: '为当前账号保存供应商、模型和 API Key。登录后会自动恢复这组配置。',
        back: '返回',
      };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,_#eff6ff_0%,_#dbeafe_38%,_#ffffff_100%)] px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[32px] border border-white/60 bg-white/92 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">AI</div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{copy.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{copy.desc}</p>
            </div>
            <button type="button" onClick={() => navigate(-1)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{copy.back}</button>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/60 bg-white/92 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <AccountAiSettingsPanel />
        </section>
      </div>
    </div>
  );
}
