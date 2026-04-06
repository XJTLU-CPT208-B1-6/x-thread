import {
  type ChangeEvent,
  type ComponentType,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Clock3,
  DoorOpen,
  FileText,
  Gamepad2,
  Home,
  ImagePlus,
  Languages,
  LogOut,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { AccountAiSettingsPanel } from '../components/AccountAiSettingsPanel';
import { GroupLobbyPanel } from '../components/GroupLobbyPanel';
import {
  accountService,
  authService,
  roomService,
  type AccountOverview,
  type AccountOverviewRoom,
} from '../services/api-client';
import {
  applyAuthSession,
  clearAuthSession,
  getStoredAuthToken,
  syncUserFromProfile,
} from '../lib/auth';
import { useLanguageStore } from '../stores/useLanguageStore';
import { useT } from '../lib/i18n';
import { saveAiSettings } from '../lib/ai-settings';
import { useRoomStore } from '../stores/useRoomStore';
import { useUserStore } from '../stores/useUserStore';

type DashboardSection =
  | 'home'
  | 'current-room'
  | 'my-room'
  | 'join-room'
  | 'create-room'
  | 'group-lobby'
  | 'recent-rooms'
  | 'discussion-outputs'
  | 'profile'
  | 'ai-references'
  | 'accessibility';

const phaseLabelMap: Record<string, string> = {
  LOBBY: '准备中',
  ICEBREAK: '破冰',
  DISCUSS: '讨论中',
  REVIEW: '复盘',
  CLOSED: '已结束',
};

const formatTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '暂无';

const resolveRoomPathFromPhase = (code: string, phase: string) => {
  switch (phase) {
    case 'ICEBREAK':
      return `/room/${code}/icebreak`;
    case 'DISCUSS':
      return `/room/${code}/discuss`;
    case 'REVIEW':
      return `/room/${code}/review`;
    default:
      return `/room/${code}/lobby`;
  }
};

const resolveRoomPath = (room: AccountOverviewRoom) =>
  resolveRoomPathFromPhase(room.code, room.phase);

const getInitials = (name?: string | null) => {
  const source = name?.trim();
  if (!source) {
    return 'XT';
  }

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Avatar read failed'));
    reader.readAsDataURL(file);
  });

const SidebarAvatar = ({
  name,
  avatar,
  busy,
}: {
  name?: string | null;
  avatar?: string | null;
  busy?: boolean;
}) => (
  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-sm">
    {avatar ? (
      <img src={avatar} alt={name ?? 'avatar'} className="h-full w-full object-cover" />
    ) : (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-400 via-blue-500 to-purple-500 text-2xl font-black text-white">
        {getInitials(name)}
      </div>
    )}

    {busy ? (
      <div className="absolute inset-0 flex items-center justify-center bg-blue-950/55 text-[11px] font-semibold text-white">
        上传中
      </div>
    ) : null}
  </div>
);

const DashboardCard = ({
  title,
  eyebrow,
  description,
  children,
  action,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) => (
  <section className="rounded-[30px] border border-blue-200 bg-white/95 p-6 shadow-[0_24px_60px_rgba(30,58,138,0.08)] backdrop-blur">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow ? (
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-purple-700">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="mt-2 text-2xl font-black tracking-tight text-blue-950">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-7 text-blue-800/70">{description}</p>
        ) : null}
      </div>
      {action}
    </div>

    <div className="mt-6">{children}</div>
  </section>
);

// ── MyRoomEditor ────────────────────────────────────────────────────────────
const VIBE_TAGS_EDITOR = ['认真学习 📚', '佛系摸鱼 🐟', '赶DDL 🔥', '头脑风暴 💡', '互相监督 👀', '随便聊聊 💬'];
const COURSE_TAGS_EDITOR = ['高数', '英语', '编程', '物理', '经济', '设计'];

function MyRoomEditor({
  room,
  onNavigate,
  onRefresh,
}: {
  room: import('../services/api-client').AccountOverviewRoom;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    topic: room.topic,
    maxMembers: room.maxMembers,
    isLocked: false,
    tags: [] as string[],
  });
  const [customTag, setCustomTag] = useState('');
  const [saveError, setSaveError] = useState('');

  // Fetch full room data (including tags/isLocked) when editing opens
  const [fullRoom, setFullRoom] = useState<any>(null);
  useEffect(() => {
    if (!editing) return;
    roomService.getRoomByCode(room.code).then((r: any) => {
      setFullRoom(r);
      setForm({ topic: r.topic, maxMembers: r.maxMembers, isLocked: r.isLocked ?? false, tags: r.tags ?? [] });
    }).catch(() => {});
  }, [editing, room.code]);

  const toggleTag = (tag: string) =>
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));

  const addCustomTag = () => {
    const t = customTag.trim();
    if (!t || form.tags.includes(t)) { setCustomTag(''); return; }
    setForm((f) => ({ ...f, tags: [...f.tags, t] }));
    setCustomTag('');
  };

  const handleSave = async () => {
    if (!form.topic.trim()) { setSaveError('主题不能为空'); return; }
    setSaving(true); setSaveError('');
    try {
      await roomService.updateRoom(fullRoom?.id ?? '', {
        topic: form.topic.trim(),
        maxMembers: form.maxMembers,
        isLocked: form.isLocked,
        tags: form.tags,
      });
      setEditing(false);
      onRefresh();
    } catch (e: any) {
      setSaveError(e?.response?.data?.message ?? '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const phaseLabelMap: Record<string, string> = {
    LOBBY: '准备中', ICEBREAK: '破冰', DISCUSS: '讨论中', REVIEW: '复盘', CLOSED: '已结束',
  };

  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-purple-500 font-semibold">{room.code}</div>
          <div className="mt-1 text-base font-bold text-blue-950">{room.topic}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 border border-purple-100">
            {phaseLabelMap[room.phase] ?? room.phase}
          </span>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition border ${
              editing ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
            }`}
          >
            {editing ? '取消' : '✏️ 编辑'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate(resolveRoomPathFromPhase(room.code, room.phase))}
            className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            进入房间
          </button>
        </div>
      </div>

      <div className="text-xs text-blue-800/60 mb-3">
        {room.memberCount}/{room.maxMembers} 人 · {room.mode === 'REMOTE' ? '远程' : '线下'}
      </div>

      {/* Edit form */}
      {editing && (
        <div className="border-t border-slate-100 pt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">讨论主题</label>
            <input value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">人数上限</label>
            <div className="flex gap-2">
              {[2, 4, 6, 8, 10].map((n) => (
                <button key={n} type="button" onClick={() => setForm((f) => ({ ...f, maxMembers: n }))}
                  className={`flex-1 rounded-xl py-1.5 text-sm font-bold transition border ${
                    form.maxMembers === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  }`}>{n}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">锁定状态</label>
            <button type="button" onClick={() => setForm((f) => ({ ...f, isLocked: !f.isLocked }))}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition border ${
                form.isLocked ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}>
              {form.isLocked ? '🔒 已锁定（点击解锁）' : '🟢 开放中（点击锁定）'}
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">标签</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {[...VIBE_TAGS_EDITOR, ...COURSE_TAGS_EDITOR].map((tag) => (
                <button key={tag} type="button" onClick={() => toggleTag(tag)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition border ${
                    form.tags.includes(tag) ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300'
                  }`}>{tag}</button>
              ))}
              {form.tags.filter((t) => !VIBE_TAGS_EDITOR.includes(t) && !COURSE_TAGS_EDITOR.includes(t)).map((tag) => (
                <button key={tag} type="button" onClick={() => toggleTag(tag)}
                  className="rounded-full px-2.5 py-1 text-xs font-semibold border bg-blue-600 text-white border-blue-600">
                  {tag} ×
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={customTag} onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }}
                placeholder="自定义标签，回车添加" maxLength={12}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              <button type="button" onClick={addCustomTag} disabled={!customTag.trim()}
                className="rounded-xl border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-40">
                + 添加
              </button>
            </div>
          </div>

          {saveError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{saveError}</div>
          )}

          <button type="button" onClick={() => void handleSave()} disabled={saving}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
            {saving ? '保存中...' : '保存修改'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function HomeWorkspacePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { setRoom, clearRoom } = useRoomStore();
  const { user } = useUserStore();
  const t = useT();
  const { language, setLanguage } = useLanguageStore();
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const initialSection = (searchParams.get('section') as DashboardSection | null) ?? 'home';
  const [activeSection, setActiveSection] = useState<DashboardSection>(initialSection);
  const [accountForm, setAccountForm] = useState({ account: '', nickname: '', password: '' });
  const [roomForm, setRoomForm] = useState({
    topic: '',
    code: '',
    mode: 'ONSITE' as 'ONSITE' | 'REMOTE',
    maxMembers: 8,
  });
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [roomBusy, setRoomBusy] = useState(false);
  const [overviewBusy, setOverviewBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [roomError, setRoomError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileForm, setProfileForm] = useState({ nickname: '', realName: '', xjtluEmail: '' });
  const [profileSaving, setProfileSaving] = useState(false);

  const refreshAccountData = async () => {
    if (!user?.id && !getStoredAuthToken()) {
      setOverview(null);
      return;
    }

    setOverviewBusy(true);
    try {
      const [nextOverview, nextAiSettings] = await Promise.all([
        accountService.getOverview(),
        accountService.getAiSettings(),
      ]);
      setOverview(nextOverview);
      syncUserFromProfile(nextOverview.user);
      saveAiSettings(nextAiSettings);
    } catch (error: any) {
      clearAuthSession();
      clearRoom();
      setOverview(null);
      setAuthError(error?.response?.data?.message ?? '账号状态已失效，请重新登录');
    } finally {
      setOverviewBusy(false);
    }
  };

  useEffect(() => {
    void refreshAccountData();
  }, [user?.id]);

  // Sync profile form when user data is available
  useEffect(() => {
    if (user) {
      setProfileForm({
        nickname: user.name ?? '',
        realName: user.realName ?? '',
        xjtluEmail: user.xjtluEmail ?? '',
      });
    }
  }, [user?.name, user?.realName, user?.xjtluEmail]);

  const updateAccountForm = (patch: Partial<typeof accountForm>) => {
    setAccountForm((current) => ({ ...current, ...patch }));
    setAuthError('');
    setAuthMessage('');
  };

  const updateRoomForm = (patch: Partial<typeof roomForm>) => {
    setRoomForm((current) => ({ ...current, ...patch }));
    setRoomError('');
  };

  const resetProfileFeedback = () => {
    setProfileNotice('');
    setProfileError('');
  };

  const handleLogin = async () => {
    if (!accountForm.account.trim() || !accountForm.password.trim()) {
      setAuthError('请输入账号和密码');
      return;
    }

    setAuthBusy(true);
    setAuthError('');
    setAuthMessage('');
    try {
      const session = await authService.login({
        account: accountForm.account.trim(),
        password: accountForm.password,
      });
      applyAuthSession(session);
      setAuthMessage('登录成功，账号数据已恢复。');
      setActiveSection('home');
      await refreshAccountData();
    } catch (error: any) {
      setAuthError(error?.response?.data?.message ?? '登录失败');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRegister = async () => {
    const payload = {
      account: accountForm.account.trim(),
      nickname: accountForm.nickname.trim(),
      password: accountForm.password,
    };

    if (!payload.account || !payload.nickname || !payload.password) {
      setAuthError('请完整填写注册信息');
      return;
    }

    setAuthBusy(true);
    setAuthError('');
    setAuthMessage('');
    try {
      const session = await authService.register(payload);
      applyAuthSession(session);
      setAuthMessage('注册成功，当前账号已登录。');
      setActiveSection('home');
      await refreshAccountData();
    } catch (error: any) {
      setAuthError(error?.response?.data?.message ?? '注册失败');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!roomForm.topic.trim()) {
      setRoomError('请输入讨论主题');
      return;
    }

    setRoomBusy(true);
    setRoomError('');
    try {
      const result = await roomService.createRoom({
        topic: roomForm.topic.trim(),
        mode: roomForm.mode,
        maxMembers: roomForm.maxMembers,
      });
      setRoom(result.room);
      navigate(`/room/${result.room.code}/lobby`);
    } catch (error: any) {
      setRoomError(error?.response?.data?.message ?? '创建房间失败');
    } finally {
      setRoomBusy(false);
    }
  };

  const handleJoinRoom = async (code = roomForm.code) => {
    if (!code.trim()) {
      setRoomError('请输入房间码');
      return;
    }

    setRoomBusy(true);
    setRoomError('');
    try {
      const result = await roomService.joinRoom(code.trim().toUpperCase());
      setRoom(result.room);
      navigate(resolveRoomPathFromPhase(result.room.code, result.room.phase));
    } catch (error: any) {
      setRoomError(error?.response?.data?.message ?? '加入房间失败');
    } finally {
      setRoomBusy(false);
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    clearRoom();
    setOverview(null);
    setActiveSection('home');
    setAuthTab('login');
    setAuthMessage('已退出登录。');
    setAuthError('');
    setRoomError('');
    resetProfileFeedback();
  };

  const handleAvatarPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    resetProfileFeedback();

    if (!file.type.startsWith('image/')) {
      setProfileError('头像文件必须是图片格式');
      return;
    }

    if (file.size > 450 * 1024) {
      setProfileError('头像图片请控制在 450KB 以内');
      return;
    }

    setAvatarBusy(true);
    try {
      const avatarDataUrl = await readFileAsDataUrl(file);
      const result = await accountService.updateProfile({ avatarDataUrl });
      syncUserFromProfile(result.user);
      setProfileNotice('头像已更新。');
      await refreshAccountData();
    } catch (error: any) {
      setProfileError(error?.response?.data?.message ?? '头像上传失败');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleClearAvatar = async () => {
    resetProfileFeedback();
    setAvatarBusy(true);
    try {
      const result = await accountService.updateProfile({ clearAvatar: true });
      syncUserFromProfile(result.user);
      setProfileNotice('头像已移除。');
      await refreshAccountData();
    } catch (error: any) {
      setProfileError(error?.response?.data?.message ?? '头像移除失败');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleCancelAccount = async () => {
    const confirmed = window.confirm(
      '注销后将清空当前账号的登录凭据、头像和 AI 设置，且无法恢复。你必须先退出所有正在参与的房间。是否继续？',
    );
    if (!confirmed) {
      return;
    }

    resetProfileFeedback();
    setAccountBusy(true);
    try {
      await accountService.cancelAccount();
      clearAuthSession();
      clearRoom();
      setOverview(null);
      setActiveSection('home');
      setAuthTab('login');
      setAuthMessage('账号已注销。');
    } catch (error: any) {
      setProfileError(error?.response?.data?.message ?? '账号注销失败');
    } finally {
      setAccountBusy(false);
    }
  };

  const renderCreateRoom = () => (
    <DashboardCard
      eyebrow="Create Room"
      title="创建新房间"
      description="发起一个新的讨论房间，设置主题、模式和人数上限。"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <label className="mb-2 block text-sm font-medium text-blue-950">讨论主题</label>
          <input
            value={roomForm.topic}
            onChange={(event) => updateRoomForm({ topic: event.target.value })}
            placeholder="例如：AI 如何改变工程协作"
            className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-blue-950">房间模式</label>
          <select
            value={roomForm.mode}
            onChange={(event) =>
              updateRoomForm({ mode: event.target.value as 'ONSITE' | 'REMOTE' })
            }
            className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100 text-blue-950"
          >
            <option value="ONSITE">线下协作</option>
            <option value="REMOTE">远程协作</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-blue-950">人数上限</label>
          <input
            type="number"
            min={2}
            max={20}
            value={roomForm.maxMembers}
            onChange={(event) =>
              updateRoomForm({
                maxMembers: Math.max(2, Math.min(20, Number(event.target.value) || 8)),
              })
            }
            className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100 text-blue-950"
          />
        </div>
      </div>

      {roomError ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {roomError}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void handleCreateRoom()}
        disabled={roomBusy}
        className="mt-5 inline-flex rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {roomBusy ? '处理中...' : '创建并进入房间'}
      </button>
    </DashboardCard>
  );

  const renderJoinRoom = () => (
    <DashboardCard
      eyebrow="Join Room"
      title="加入房间"
      description="输入 6 位房间码，快速加入已有的讨论。"
    >
      <div>
        <label className="mb-2 block text-sm font-medium text-blue-950">房间码</label>
        <input
          value={roomForm.code}
          onChange={(event) => updateRoomForm({ code: event.target.value.toUpperCase() })}
          placeholder="输入 6 位房间码"
          maxLength={6}
          className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm font-semibold uppercase tracking-[0.28em] outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100 text-blue-950"
        />
      </div>

      {roomError ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {roomError}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void handleJoinRoom()}
        disabled={roomBusy}
        className="mt-5 inline-flex rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {roomBusy ? '处理中...' : '加入并继续讨论'}
      </button>
    </DashboardCard>
  );

  const renderActiveRooms = () => (
    <DashboardCard
      eyebrow="Active Rooms"
      title="正在参与的房间"
      description="这些房间仍然处于你的活跃成员状态，可以直接回到对应阶段继续。"
      action={
        <button
          type="button"
          onClick={() => void refreshAccountData()}
          className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
        >
          <RefreshCw className="h-4 w-4" />
          刷新
        </button>
      }
    >
      <div className="space-y-3">
        {overviewBusy ? (
          <div className="rounded-2xl border border-dashed border-blue-200 px-4 py-6 text-center text-sm text-blue-500">
            正在同步当前账号下的活跃房间...
          </div>
        ) : null}

        {!overviewBusy && (overview?.activeRooms.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-dashed border-blue-200 px-4 py-6 text-center text-sm text-blue-500">
            当前账号还没有活跃房间。
          </div>
        ) : null}

        {overview?.activeRooms.map((room) => (
          <div
            key={`${room.roomId}:${room.status}`}
            className="rounded-3xl border border-blue-100 bg-white px-5 py-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-purple-500">{room.code}</div>
                <div className="mt-2 text-lg font-bold text-blue-950">{room.topic}</div>
              </div>
              <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 border border-purple-100">
                {phaseLabelMap[room.phase] ?? room.phase}
              </span>
            </div>

            <div className="mt-3 grid gap-2 text-sm text-blue-800/70 sm:grid-cols-2">
              <div>角色：{room.role === 'OWNER' ? '房主' : '成员'}</div>
              <div>人数：{room.memberCount}/{room.maxMembers}</div>
              <div>最近在线：{formatTime(room.lastSeenAt)}</div>
              <div>模式：{room.mode === 'REMOTE' ? '远程' : '线下'}</div>
            </div>

            <button
              type="button"
              onClick={() => navigate(resolveRoomPath(room))}
              className="mt-4 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              继续进入
            </button>
          </div>
        ))}
      </div>
    </DashboardCard>
  );

  const renderHistoryRooms = () => (
    <DashboardCard
      eyebrow="Room History"
      title="14 天内的房间记录"
      description="离开后的房间历史会保留 14 天，你可以查看历史内容，也可以重新加入。"
    >
      <div className="space-y-3">
        {!overviewBusy && (overview?.roomHistory.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-dashed border-blue-200 px-4 py-6 text-center text-sm text-blue-500">
            还没有最近 14 天内的房间历史。
          </div>
        ) : null}

        {overview?.roomHistory.map((room) => (
          <div
            key={`${room.roomId}:${room.leftAt ?? room.joinedAt}`}
            className="rounded-3xl border border-blue-100 bg-white px-5 py-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-blue-400">{room.code}</div>
                <div className="mt-2 text-lg font-bold text-blue-950">{room.topic}</div>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-100">
                {room.leftAt ? `离开于 ${formatTime(room.leftAt)}` : '历史记录'}
              </span>
            </div>

            <div className="mt-3 grid gap-2 text-sm text-blue-800/70 sm:grid-cols-2">
              <div>首次加入：{formatTime(room.joinedAt)}</div>
              <div>最近在线：{formatTime(room.lastSeenAt)}</div>
              <div>阶段：{phaseLabelMap[room.phase] ?? room.phase}</div>
              <div>模式：{room.mode === 'REMOTE' ? '远程' : '线下'}</div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate(`/room/${room.code}/history`)}
                className="rounded-2xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
              >
                查看历史
              </button>
              <button
                type="button"
                onClick={() => void handleJoinRoom(room.code)}
                className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                重新加入
              </button>
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );

  const renderRecentRooms = () => {
    const allRooms = [
      ...(overview?.activeRooms ?? []).map((r) => ({ ...r, isActive: true as const })),
      ...(overview?.roomHistory ?? []).map((r) => ({ ...r, isActive: false as const })),
    ];

    return (
      <DashboardCard
        eyebrow="Recent Rooms"
        title="最近的房间"
        description="包含你正在参与的房间和 14 天内的历史记录。"
        action={
          <button
            type="button"
            onClick={() => void refreshAccountData()}
            className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
        }
      >
        <div className="space-y-3">
          {overviewBusy ? (
            <div className="rounded-2xl border border-dashed border-blue-200 px-4 py-6 text-center text-sm text-blue-500">
              正在同步房间数据...
            </div>
          ) : allRooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-blue-200 px-4 py-6 text-center text-sm text-blue-500">
              暂无房间记录。
            </div>
          ) : (
            allRooms.map((room) => (
              <div
                key={`${room.roomId}:${room.isActive ? 'active' : (room.leftAt ?? room.joinedAt)}`}
                className="rounded-3xl border border-blue-100 bg-white px-5 py-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className={`text-xs uppercase tracking-[0.18em] ${room.isActive ? 'text-purple-500' : 'text-blue-400'}`}>
                      {room.code}
                    </div>
                    <div className="mt-2 text-lg font-bold text-blue-950">{room.topic}</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                    room.isActive
                      ? 'bg-purple-50 text-purple-700 border-purple-100'
                      : 'bg-amber-50 text-amber-700 border-amber-100'
                  }`}>
                    {room.isActive
                      ? (phaseLabelMap[room.phase] ?? room.phase)
                      : (room.leftAt ? `离开于 ${formatTime(room.leftAt)}` : '历史记录')}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-blue-800/70 sm:grid-cols-2">
                  <div>角色：{room.role === 'OWNER' ? '房主' : '成员'}</div>
                  <div>人数：{room.memberCount}/{room.maxMembers}</div>
                  <div>最近在线：{formatTime(room.lastSeenAt)}</div>
                  <div>模式：{room.mode === 'REMOTE' ? '远程' : '线下'}</div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {room.isActive ? (
                    <button
                      type="button"
                      onClick={() => navigate(resolveRoomPath(room))}
                      className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      继续进入
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => navigate(`/room/${room.code}/history`)}
                        className="rounded-2xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                      >
                        查看历史
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleJoinRoom(room.code)}
                        className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        重新加入
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DashboardCard>
    );
  };

  const renderAiSettings = () => (
    <DashboardCard
      eyebrow="AI Settings"
      title="账号级 AI 设置"
      description="保存后会跟随当前账号自动恢复，不需要每次重新输入。"
    >
      <AccountAiSettingsPanel onSaved={() => void refreshAccountData()} />
    </DashboardCard>
  );

  const renderHome = () => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? '早安' : hour < 18 ? '下午好' : '晚上好';
    const activeCount = overview?.activeRooms.length ?? 0;
    const latestActive = overview?.activeRooms[0] ?? null;
    const latestHistory = overview?.roomHistory.slice(0, 3) ?? [];
    const hasAiKey = overview?.aiSettings.hasApiKey ?? false;

    return (
      <div className="space-y-6">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-600 to-violet-600 p-6 text-white">
          {/* decorative star */}
          <div className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 opacity-10">
            <Sparkles className="h-32 w-32" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-2 flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            待办继续
          </div>
          <h1 className="text-2xl font-black leading-snug mb-1">
            {greeting}，{user?.name} 👋
          </h1>
          <p className="text-base font-semibold text-white/90 mb-4">
            你今天有{' '}
            <span className="text-yellow-300 font-black">{activeCount}</span>{' '}
            个待继续讨论
          </p>
          {latestActive ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-white/15 px-3 py-2 backdrop-blur-sm">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-white/60 mb-0.5">
                  最近一次讨论主题
                </div>
                <div className="text-sm font-bold text-white">{latestActive.topic}</div>
              </div>
              <button
                type="button"
                onClick={() => navigate(resolveRoomPath(latestActive))}
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-indigo-700 transition hover:bg-white/90"
              >
                快速进入 →
              </button>
            </div>
          ) : (
            <div className="text-sm text-white/60">暂无活跃房间，点击下方快捷入口开始。</div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            {/* Quick Access */}
            <div>
              <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-700">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                快捷入口
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    icon: <PlusCircle className="h-6 w-6 text-indigo-500" />,
                    bg: 'bg-indigo-50',
                    label: '创建课堂讨论',
                    sub: '快速发起学术研讨',
                    action: () => setActiveSection('create-room'),
                  },
                  {
                    icon: <Users className="h-6 w-6 text-emerald-500" />,
                    bg: 'bg-emerald-50',
                    label: '加入房间',
                    sub: '输入房间码快速进入',
                    action: () => setActiveSection('join-room'),
                  },
                  {
                    icon: <Sparkles className="h-6 w-6 text-amber-500" />,
                    bg: 'bg-amber-50',
                    label: '开始破冰',
                    sub: 'AI 辅助活跃气氛',
                    action: () => latestActive && navigate(resolveRoomPath(latestActive)),
                  },
                  {
                    icon: <FileText className="h-6 w-6 text-rose-500" />,
                    bg: 'bg-rose-50',
                    label: '从文件生成讨论',
                    sub: '上传 PDF/PPT 自动解析',
                    action: () => setActiveSection('create-room'),
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    className="flex flex-col items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:shadow-md hover:border-slate-200"
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.bg}`}>
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{item.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{item.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Discussion Outputs */}
            <div>
              <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-700">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                最近讨论成果
              </div>
              <div className="space-y-2">
                {latestHistory.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                    暂无历史讨论记录
                  </div>
                ) : (
                  latestHistory.map((room) => (
                    <button
                      key={room.roomId}
                      type="button"
                      onClick={() => navigate(`/room/${room.code}/history`)}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left shadow-sm transition hover:shadow-md hover:border-slate-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                          <MessageSquare className="h-4 w-4 text-blue-500" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{room.topic}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {room.leftAt ? `离开于 ${formatTime(room.leftAt)}` : `最近在线 ${formatTime(room.lastSeenAt)}`}
                          </div>
                        </div>
                      </div>
                      <span className="text-slate-300 text-lg">→</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* AI Suggestions Panel */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1 text-sm font-bold text-slate-700">
              <Sparkles className="h-4 w-4 text-violet-500" />
              AI 助手建议
            </div>

            {/* Privacy tip */}
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 mb-3">
                <User className="h-4 w-4 text-white" />
              </div>
              <div className="text-sm font-bold text-slate-800 mb-1">隐私提醒</div>
              <p className="text-xs text-slate-500 leading-relaxed">
                你最近参与较少，建议使用<span className="font-semibold text-slate-700">匿名模式</span>参与讨论，这有助于你更自由地表达观点。
              </p>
              <button
                type="button"
                onClick={() => setActiveSection('profile')}
                className="mt-2 text-xs font-semibold text-indigo-600 hover:underline"
              >
                立即开启 →
              </button>
            </div>

            {/* Pending task */}
            {latestHistory.length > 0 && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 mb-3">
                  <Clock3 className="h-4 w-4 text-white" />
                </div>
                <div className="text-sm font-bold text-slate-800 mb-1">任务待续</div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  上一讨论「{latestHistory[0].topic}」未完成总结，是否现在继续生成？
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/room/${latestHistory[0].code}/history`)}
                  className="mt-2 text-xs font-semibold text-amber-600 hover:underline"
                >
                  继续总结 →
                </button>
              </div>
            )}

            {/* Weekly activity */}
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-slate-800">本周活跃度</div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                  {activeCount > 0 ? 'ACTIVE' : 'GOOD'}
                </span>
              </div>
              <div className="flex items-end justify-between gap-1 h-10 mb-2">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                  const height = [30, 50, 70, 40, 90, 20, 10][i];
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-sm bg-indigo-200"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <span key={i} className="flex-1 text-center">{d}</span>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {hasAiKey ? '已配置 AI，可使用全部功能。' : '比上周多参与了 12% 的讨论'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleSaveProfile = async () => {
    resetProfileFeedback();
    setProfileSaving(true);
    try {
      const result = await accountService.updateProfile({
        nickname: profileForm.nickname.trim() || undefined,
        realName: profileForm.realName.trim(),
        xjtluEmail: profileForm.xjtluEmail.trim(),
      });
      syncUserFromProfile(result.user);
      setProfileNotice('个人信息已保存。');
      await refreshAccountData();
    } catch (error: any) {
      setProfileError(error?.response?.data?.message ?? '保存失败');
    } finally {
      setProfileSaving(false);
    }
  };

  const renderProfile = () => {
    return (
      <DashboardCard eyebrow="Profile" title="个人信息">
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Avatar column */}
          <div className="flex flex-col items-center gap-3 lg:w-40 shrink-0">
            <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-400 to-violet-500 text-2xl font-black text-white">
                  {getInitials(user?.name)}
                </div>
              )}
              {avatarBusy && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-semibold text-white">
                  上传中
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              onChange={(event) => void handleAvatarPick(event)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarBusy}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              更换头像
            </button>
            {user?.avatar && (
              <button
                type="button"
                onClick={() => void handleClearAvatar()}
                disabled={avatarBusy}
                className="w-full rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-500 transition hover:bg-rose-50 disabled:opacity-50"
              >
                移除头像
              </button>
            )}
            <p className="text-center text-[11px] text-slate-400 leading-relaxed">
              PNG / JPG / WEBP<br />最大 450 KB
            </p>
          </div>

          {/* Fields column */}
          <div className="flex-1 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  账号 ID
                </label>
                <input
                  value={user?.account ?? ''}
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-400 cursor-not-allowed"
                />
                <p className="mt-1 text-[11px] text-slate-400">账号 ID 不可修改</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  昵称 <span className="text-rose-400">*</span>
                </label>
                <input
                  value={profileForm.nickname}
                  onChange={(e) => setProfileForm((f) => ({ ...f, nickname: e.target.value }))}
                  placeholder="房间内显示的名字"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  真实姓名
                </label>
                <input
                  value={profileForm.realName}
                  onChange={(e) => setProfileForm((f) => ({ ...f, realName: e.target.value }))}
                  placeholder="例如：张三"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  西浦邮箱
                </label>
                <input
                  value={profileForm.xjtluEmail}
                  onChange={(e) => setProfileForm((f) => ({ ...f, xjtluEmail: e.target.value }))}
                  placeholder="xxx@student.xjtlu.edu.cn"
                  type="email"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  仅接受 @xjtlu.edu.cn 或 @student.xjtlu.edu.cn
                </p>
              </div>
            </div>

            {profileNotice && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
                {profileNotice}
              </div>
            )}
            {profileError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-600">
                {profileError}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleSaveProfile()}
              disabled={profileSaving}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {profileSaving ? '保存中...' : '保存信息'}
            </button>
          </div>
        </div>
      </DashboardCard>
    );
  };

  const renderMyRooms = () => {
    const myOwnedRooms = overview?.activeRooms.filter((r) => r.role === 'OWNER') ?? [];

    return (
      <DashboardCard
        eyebrow="My Rooms"
        title="我的房间"
        description="你是房主的房间。可以在这里修改房间属性，只有房主才能修改。"
        action={
          <button type="button" onClick={() => void refreshAccountData()}
            className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">
            <RefreshCw className="h-4 w-4" />刷新
          </button>
        }
      >
        <div className="space-y-4">
          {myOwnedRooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-blue-200 px-4 py-8 text-center text-sm text-blue-500">
              你目前没有作为房主的活跃房间。
            </div>
          ) : (
            myOwnedRooms.map((room) => (
              <MyRoomEditor
                key={room.roomId}
                room={room}
                onNavigate={(path) => navigate(path)}
                onRefresh={() => void refreshAccountData()}
              />
            ))
          )}
        </div>
      </DashboardCard>
    );
  };

  const renderAccessibility = () => (
    <DashboardCard eyebrow={t('section.accessibility')} title={t('accessibility.title')}>
      <p className="mb-6 text-sm text-slate-500">{t('accessibility.subtitle')}</p>
      <div className="flex items-center gap-4">
        <span className={`text-sm font-semibold ${language === 'zh' ? 'text-blue-600' : 'text-slate-400'}`}>
          {t('accessibility.chinese')}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={language === 'en'}
          onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
          className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            language === 'en' ? 'bg-blue-600' : 'bg-slate-200'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
              language === 'en' ? 'translate-x-7' : 'translate-x-0.5'
            }`}
          />
        </button>
        <span className={`text-sm font-semibold ${language === 'en' ? 'text-blue-600' : 'text-slate-400'}`}>
          {t('accessibility.english')}
        </span>
      </div>
      <p className="mt-4 text-xs text-slate-400">{t('accessibility.hint')}</p>
    </DashboardCard>
  );

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'ai-references':
        return renderAiSettings();
      case 'current-room':
        return renderActiveRooms();
      case 'my-room':
        return renderMyRooms();
      case 'recent-rooms':
        return renderRecentRooms();
      case 'discussion-outputs':
        return renderHistoryRooms();
      case 'create-room':
        return renderCreateRoom();
      case 'group-lobby':
        return <GroupLobbyPanel />;
      case 'join-room':
        return renderJoinRoom();
      case 'profile':
        return renderProfile();
      case 'accessibility':
        return renderAccessibility();
      case 'home':
      default:
        return renderHome();
    }
  };

  const sectionMeta: Record<
    DashboardSection,
    { label: string; description: string; icon: ComponentType<{ className?: string }> }
  > = {
    home: { label: t('section.home'), description: t('section.home.desc'), icon: Home },
    'current-room': { label: t('section.currentRoom'), description: t('section.currentRoom.desc'), icon: DoorOpen },
    'my-room': { label: '我的房间', description: '管理你创建的房间，修改主题、标签、人数和锁定状态。', icon: Settings2 },
    'join-room': { label: t('section.joinRoom'), description: t('section.joinRoom.desc'), icon: Users },
    'create-room': { label: t('section.createRoom'), description: t('section.createRoom.desc'), icon: PlusCircle },
    'group-lobby': { label: '组队大厅', description: '找队友，开房间，入座即聊。', icon: Gamepad2 },
    'recent-rooms': { label: t('section.recentRooms'), description: t('section.recentRooms.desc'), icon: Clock3 },
    'discussion-outputs': { label: t('section.discussionOutputs'), description: t('section.discussionOutputs.desc'), icon: MessageSquare },
    profile: { label: t('section.profile'), description: t('section.profile.desc'), icon: User },
    'ai-references': { label: t('section.aiReferences'), description: t('section.aiReferences.desc'), icon: Settings2 },
    accessibility: { label: t('section.accessibility'), description: t('section.accessibility.desc'), icon: Languages },
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.14),_transparent_28%),linear-gradient(135deg,_#eff6ff_0%,_#dbeafe_38%,_#ffffff_100%)] px-4 py-8 text-blue-950 flex flex-col items-center justify-center">
        <div className="w-full max-w-lg mx-auto flex flex-col items-center">
          {/* Logo and Title */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-xl text-white font-black text-2xl">
              XT
            </div>
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-purple-700 mb-2">
                Welcome to X-Thread
              </div>
              <h1 className="text-3xl font-black tracking-tight text-blue-950">
                X-Thread
              </h1>
            </div>
          </div>

          <section className="w-full rounded-[34px] border border-blue-200/60 bg-white/95 p-8 shadow-[0_32px_90px_rgba(30,58,138,0.12)] backdrop-blur flex flex-col justify-center mb-8 relative z-10">
            <div className="mb-6 flex rounded-2xl bg-blue-50 p-1 border border-blue-100">
              {(['login', 'register'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setAuthTab(tab)}
                  className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    authTab === tab
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-blue-700/70 hover:text-blue-900'
                  }`}
                >
                  {tab === 'login' ? '账号登录' : '账号注册'}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-blue-950">账号</label>
                <input
                  value={accountForm.account}
                  onChange={(event) => updateAccountForm({ account: event.target.value })}
                  placeholder="例如 xthread_team01"
                  className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100 text-blue-950"
                />
              </div>

              {authTab === 'register' ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-blue-950">昵称</label>
                  <input
                    value={accountForm.nickname}
                    onChange={(event) => updateAccountForm({ nickname: event.target.value })}
                    placeholder="房间内显示的名字"
                    className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100 text-blue-950"
                  />
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-medium text-blue-950">密码</label>
                <input
                  type="password"
                  value={accountForm.password}
                  onChange={(event) => updateAccountForm({ password: event.target.value })}
                  placeholder={authTab === 'login' ? '输入账号密码' : '至少 6 位'}
                  className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100 text-blue-950"
                />
              </div>

              {authMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {authMessage}
                </div>
              ) : null}
              {authError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {authError}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void (authTab === 'login' ? handleLogin() : handleRegister())}
                disabled={authBusy}
                className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 mt-2"
              >
                {authBusy
                  ? '处理中...'
                  : authTab === 'login'
                    ? '登录并进入工作台'
                    : '注册并进入工作台'}
              </button>
            </div>
          </section>

          {/* Features and Description Below Form */}
          <div className="w-full text-center px-4 max-w-2xl">
             <h2 className="text-xl font-bold tracking-tight text-blue-950 mb-3">
               新一代 AI 驱动的工程协作空间
             </h2>
             <p className="text-sm leading-6 text-blue-800/80 mb-8">
               X-Thread 致力于将 AI 能力深度融合到日常工程讨论中，提供无缝的白板、思维导图、实时音视频以及全流程的讨论记录复盘功能。
             </p>

             <div className="grid gap-4 sm:grid-cols-3 text-left">
                <div className="flex flex-col items-center text-center p-5 rounded-[24px] bg-blue-50/40 border border-blue-100/50 hover:bg-blue-50/80 transition-colors">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100/80 text-blue-600 mb-3">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-bold text-blue-950 mb-2">实时多模态协作</div>
                  <div className="text-xs text-blue-800/70 leading-relaxed">支持多人实时在线讨论，同步思维导图与白板。</div>
                </div>
                
                <div className="flex flex-col items-center text-center p-5 rounded-[24px] bg-purple-50/40 border border-purple-100/50 hover:bg-purple-50/80 transition-colors">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100/80 text-purple-600 mb-3">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-bold text-blue-950 mb-2">AI 助手沉浸式介入</div>
                  <div className="text-xs text-blue-800/70 leading-relaxed">随时呼叫 AI，总结内容、生成报告、解答疑问。</div>
                </div>
                
                <div className="flex flex-col items-center text-center p-5 rounded-[24px] bg-emerald-50/40 border border-emerald-100/50 hover:bg-emerald-50/80 transition-colors">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100/80 text-emerald-600 mb-3">
                    <RefreshCw className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-bold text-blue-950 mb-2">无缝会议流转复盘</div>
                  <div className="text-xs text-blue-800/70 leading-relaxed">全流程记录不丢失，随时回溯 14 天会议历史。</div>
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  const navGroups: Array<{
    group: string;
    items: Array<{ id: DashboardSection; label: string; count?: number; icon: ComponentType<{ className?: string }> }>;
  }> = [
    {
      group: t('nav.workspace'),
      items: [
        { id: 'home', label: t('nav.home'), icon: Home },
        { id: 'current-room', label: t('nav.currentRoom'), icon: DoorOpen, count: overview?.activeRooms.length ?? 0 },
        { id: 'my-room', label: '我的房间', icon: Settings2, count: overview?.activeRooms.filter((r) => r.role === 'OWNER').length ?? 0 },
        { id: 'join-room', label: t('nav.joinRoom'), icon: Users },
        { id: 'create-room', label: t('nav.createRoom'), icon: PlusCircle },
        { id: 'group-lobby', label: '组队大厅 🎮', icon: Gamepad2 },
      ],
    },
    {
      group: t('nav.history'),
      items: [
        { id: 'recent-rooms', label: t('nav.recentRooms'), icon: Clock3, count: (overview?.activeRooms.length ?? 0) + (overview?.roomHistory.length ?? 0) },
        { id: 'discussion-outputs', label: t('nav.discussionOutputs'), icon: MessageSquare },
      ],
    },
    {
      group: t('nav.settings'),
      items: [
        { id: 'profile', label: t('nav.profile'), icon: User },
        { id: 'ai-references', label: t('nav.aiReferences'), icon: Settings2 },
        { id: 'accessibility', label: t('nav.accessibility'), icon: Languages },
      ],
    },
  ];

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_20%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.12),_transparent_24%),linear-gradient(135deg,_#eff6ff_0%,_#dbeafe_32%,_#ffffff_100%)] p-4 text-blue-950">
      <div className="mx-auto flex h-full max-w-[1600px] gap-4">
        <aside className="flex w-[280px] shrink-0 flex-col overflow-hidden rounded-[32px] border border-slate-200/60 bg-white text-slate-800 shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
          {/* Console */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-100">
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400 mb-3">
              {t('console.title')}
            </div>
            <div className="flex items-center gap-3">
              <SidebarAvatar name={user.name} avatar={user.avatar} busy={avatarBusy} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-800">{user.name}</div>
                <div className="truncate text-xs text-slate-400 mt-0.5">{user.account ?? t('console.noAccount')}</div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
                title="Upload avatar"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-blue-600 disabled:opacity-50"
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              onChange={(event) => void handleAvatarPick(event)}
              className="hidden"
            />
            {profileNotice ? (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">{profileNotice}</div>
            ) : null}
            {profileError ? (
              <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-600">{profileError}</div>
            ) : null}
          </div>

          {/* Nav Groups */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {navGroups.map((group) => (
              <div key={group.group} className="mb-3">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  {group.group}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveSection(item.id);
                          resetProfileFeedback();
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-all ${
                          active
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2.5">
                          <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                          <span className="text-[13px] font-medium">{item.label}</span>
                        </span>
                        {item.count !== undefined ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {item.count}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-100 px-3 py-3 space-y-1.5">
            {user.isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
              >
                🛡️ Admin Panel
              </button>
            )}
            <button
              type="button"
              onClick={() => void refreshAccountData()}
              disabled={overviewBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${overviewBusy ? 'animate-spin' : ''}`} />
              {t('footer.refresh')}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t('footer.signOut')}
            </button>
            <button
              type="button"
              onClick={() => void handleCancelAccount()}
              disabled={accountBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {accountBusy ? t('footer.deleting') : t('footer.deleteAccount')}
            </button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-blue-200/60 bg-white/95 shadow-[0_32px_90px_rgba(30,58,138,0.08)] backdrop-blur">
          <div className="border-b border-blue-100 px-8 py-6 bg-blue-50/30">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-purple-700">
              {sectionMeta[activeSection].label}
            </div>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-blue-950">
                  {sectionMeta[activeSection].label}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-blue-800/70">
                  {sectionMeta[activeSection].description}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-100/80 px-4 py-2 text-sm font-medium text-blue-800">
                <Sparkles className="h-4 w-4 text-purple-600" />
                账号工作台
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-8 bg-white/50">{renderActiveSection()}</div>
        </main>
      </div>
    </div>
  );
}
