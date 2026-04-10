import { useMemo, useState } from 'react';
import { accountService } from '../services/api-client';
import { useLanguageStore } from '../stores/useLanguageStore';
import { CompanionProfile } from '../types/companion';

type CompanionSettingsPanelProps = {
  companions: CompanionProfile[];
  onChanged?: () => Promise<void> | void;
};

const initialForm = {
  name: '',
  emoji: '🐾',
  styleGuide: '',
  description: '',
  systemPrompt: '',
};

const localizeDefaultCompanion = (
  companion: CompanionProfile,
  language: 'zh' | 'en',
) => {
  if (!companion.isDefault) {
    return companion;
  }

  const localizedByKind: Record<
    CompanionProfile['kind'],
    { name: string; styleGuide: string; description: string }
  > =
    language === 'en'
      ? {
          CAT: {
            name: 'Soft Cat',
            styleGuide: 'Gentle and calming',
            description:
              'A gentle companion that helps ease tension and invites quieter members into the discussion.',
          },
          DOG: {
            name: 'Buddy Dog',
            styleGuide: 'Warm and energizing',
            description:
              'A lively companion that encourages members to speak up and keeps the room active.',
          },
          COMPUTER: {
            name: 'Logic Bot',
            styleGuide: 'Structured and focused',
            description:
              'A rational companion that organizes scattered ideas into clear options, questions, and next steps.',
          },
          DOLPHIN: {
            name: 'Ripple Dolphin',
            styleGuide: 'Playful and creative',
            description:
              'A creative companion that opens new angles and keeps brainstorming flowing naturally.',
          },
          CUSTOM: {
            name: companion.name,
            styleGuide: companion.styleGuide,
            description: companion.description,
          },
        }
      : {
          CAT: {
            name: '绒绒猫',
            styleGuide: '轻声安抚，温和追问',
            description: '温柔安抚型，适合缓和紧张气氛、接住略显犹豫的表达。',
          },
          DOG: {
            name: '阿旺',
            styleGuide: '热情鼓励，主动破冰',
            description: '热情鼓励型，适合带动大家开口、推进第一轮发言。',
          },
          COMPUTER: {
            name: '小机',
            styleGuide: '结构清晰，推进讨论',
            description: '理性梳理型，适合把零散观点整理成问题、选项和下一步。',
          },
          DOLPHIN: {
            name: '泡泡豚',
            styleGuide: '轻快联想，创意延展',
            description: '灵动联想型，适合抛出新角度、创意延伸和轻松话题。',
          },
          CUSTOM: {
            name: companion.name,
            styleGuide: companion.styleGuide,
            description: companion.description,
          },
        };

  return {
    ...companion,
    ...localizedByKind[companion.kind],
  };
};

export const CompanionSettingsPanel = ({ companions, onChanged }: CompanionSettingsPanelProps) => {
  const { language } = useLanguageStore();
  const copy = useMemo(
    () =>
      language === 'en'
        ? {
            missingFields: 'Fill in the pet name, chat style, description, and persona prompt first.',
            createSuccess: 'The new pet has been added to your account.',
            createFailed: 'Failed to create the pet',
            confirmDelete: (name: string, emoji?: string) => `Delete ${name}${emoji ?? ''}?`,
            deleteSuccess: (name: string) => `${name} has been removed.`,
            deleteFailed: 'Failed to delete the pet',
            defaultsTitle: 'Default Pets',
            defaultsDesc: 'These pets reuse your account AI settings. Room owners can bring several into a room and members can mention them directly with @name.',
            total: (count: number) => `${count} total`,
            defaultBadge: 'Default',
            customTitle: 'Custom Pets',
            customDesc: 'Define your own names, tones, and persona prompts. Custom pets are available whenever you are the room owner.',
            name: 'Pet Name',
            style: 'Chat Style',
            summary: 'Description',
            prompt: 'Persona Prompt',
            create: 'Create Pet',
            creating: 'Creating...',
            mine: 'My Custom Pets',
            mineDesc: 'Default pets stay permanently. Only your extra pets are listed here.',
            empty: 'No custom pets yet. Create one on the left first.',
            remove: 'Delete',
            removing: 'Deleting...',
          }
        : {
            missingFields: '请先填写宠物名称、聊天风格、简介和人格提示。',
            createSuccess: '新的电子宠物已经加入你的账户设置。',
            createFailed: '创建电子宠物失败',
            confirmDelete: (name: string, emoji?: string) => `确认删除 ${name}${emoji ?? ''} 吗？`,
            deleteSuccess: (name: string) => `${name} 已移除。`,
            deleteFailed: '删除电子宠物失败',
            defaultsTitle: '默认宠物',
            defaultsDesc: '这些宠物会复用你账户里的 AI 设置。房主可以一次带多只进房间，成员也能直接通过 @名字 和它们互动。',
            total: (count: number) => `当前共 ${count} 只`,
            defaultBadge: '默认',
            customTitle: '自定义宠物',
            customDesc: '你可以定义自己的名字、语气和人格提示。只要你是房主，就可以把它们带进房间。',
            name: '宠物名字',
            style: '聊天风格',
            summary: '简介',
            prompt: '人格提示',
            create: '新建电子宠物',
            creating: '创建中...',
            mine: '我的自定义宠物',
            mineDesc: '默认宠物会一直保留，这里只显示你额外创建的角色。',
            empty: '还没有自定义宠物，先在左侧创建一只吧。',
            remove: '删除',
            removing: '删除中...',
          },
    [language],
  );

  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const defaultCompanions = useMemo(
    () =>
      companions
        .filter((companion) => companion.isDefault)
        .map((companion) => localizeDefaultCompanion(companion, language)),
    [companions, language],
  );
  const customCompanions = useMemo(() => companions.filter((companion) => !companion.isDefault), [companions]);

  const updateForm = (patch: Partial<typeof initialForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setNotice('');
    setError('');
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.styleGuide.trim() || !form.description.trim() || !form.systemPrompt.trim()) {
      setError(copy.missingFields);
      return;
    }
    setSaving(true);
    setNotice('');
    setError('');
    try {
      await accountService.createCompanion({
        name: form.name.trim(),
        emoji: form.emoji.trim() || '🐾',
        styleGuide: form.styleGuide.trim(),
        description: form.description.trim(),
        systemPrompt: form.systemPrompt.trim(),
      });
      setForm(initialForm);
      setNotice(copy.createSuccess);
      await onChanged?.();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? copy.createFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (companion: CompanionProfile) => {
    if (!window.confirm(copy.confirmDelete(companion.name, companion.emoji))) {
      return;
    }
    setDeletingId(companion.id);
    setNotice('');
    setError('');
    try {
      await accountService.deleteCompanion(companion.id);
      setNotice(copy.deleteSuccess(companion.name));
      await onChanged?.();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? copy.deleteFailed);
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-blue-100 bg-blue-50/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-blue-950">{copy.defaultsTitle}</div>
            <p className="mt-1 text-sm text-blue-800/80">{copy.defaultsDesc}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-blue-700">{copy.total(companions.length)}</div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {defaultCompanions.map((companion) => (
            <div key={companion.id} className="rounded-3xl border border-blue-100 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-2xl">{companion.emoji}</div>
                  <div>
                    <div className="text-lg font-semibold text-slate-900">{companion.name}</div>
                    <div className="mt-1 text-xs font-medium text-blue-600">@{companion.name} · {companion.styleGuide}</div>
                  </div>
                </div>
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">{copy.defaultBadge}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{companion.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">{copy.customTitle}</div>
          <p className="mt-1 text-sm text-slate-500">{copy.customDesc}</p>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">{copy.name}</label>
                <input value={form.name} onChange={(event) => updateForm({ name: event.target.value })} placeholder={language === 'en' ? 'e.g. Night Lamp' : '例如：小夜灯'} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Emoji</label>
                <input value={form.emoji} onChange={(event) => updateForm({ emoji: event.target.value })} placeholder="🐾" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{copy.style}</label>
              <input value={form.styleGuide} onChange={(event) => updateForm({ styleGuide: event.target.value })} placeholder={language === 'en' ? 'e.g. warm, playful, good at easing tension' : '例如：幽默缓和，擅长帮人接话'} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{copy.summary}</label>
              <textarea value={form.description} onChange={(event) => updateForm({ description: event.target.value })} rows={3} placeholder={language === 'en' ? 'Describe how this pet helps soften the room, break the ice, or move the discussion forward.' : '一句话描述这个宠物如何缓和氛围、破冰或推动讨论。'} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{copy.prompt}</label>
              <textarea value={form.systemPrompt} onChange={(event) => updateForm({ systemPrompt: event.target.value })} rows={5} placeholder={language === 'en' ? 'Describe the role to AI, for example: You are a gentle pet that actively invites quieter members into the conversation with short, answerable prompts.' : '写给 AI 的角色说明，例如：你是一只会鼓励安静成员开口的电子宠物，语气轻柔但会主动抛出可回答的小问题。'} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
            </div>

            <button type="button" onClick={() => void handleCreate()} disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? copy.creating : copy.create}
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">{copy.mine}</div>
          <p className="mt-1 text-sm text-slate-500">{copy.mineDesc}</p>

          <div className="mt-4 space-y-3">
            {customCompanions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">{copy.empty}</div>
            ) : (
              customCompanions.map((companion) => (
                <div key={companion.id} className="rounded-3xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{companion.emoji}</span>
                        <div className="truncate text-lg font-semibold text-slate-900">{companion.name}</div>
                      </div>
                      <div className="mt-1 text-xs font-medium text-blue-600">@{companion.name} · {companion.styleGuide}</div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{companion.description}</p>
                    </div>
                    <button type="button" onClick={() => void handleDelete(companion)} disabled={deletingId === companion.id} className="rounded-2xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60">
                      {deletingId === companion.id ? copy.removing : copy.remove}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
    </div>
  );
};

