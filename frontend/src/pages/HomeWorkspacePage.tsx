import {
  type ChangeEvent,
  type ComponentType,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock3,
  DoorOpen,
  ImagePlus,
  LogOut,
  PlusCircle,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { AccountAiSettingsPanel } from '../components/AccountAiSettingsPanel';
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
import { saveAiSettings } from '../lib/ai-settings';
import { useRoomStore } from '../stores/useRoomStore';
import { useUserStore } from '../stores/useUserStore';

type DashboardSection = 'rooms' | 'ai' | 'active' | 'history';

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

export default function HomeWorkspacePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { setRoom, clearRoom } = useRoomStore();
  const { user } = useUserStore();
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [roomTab, setRoomTab] = useState<'create' | 'join'>('create');
  const [activeSection, setActiveSection] = useState<DashboardSection>('rooms');
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

  const aiStatusText = useMemo(() => {
    if (!overview) {
      return '请先登录';
    }

    return overview.aiSettings.hasApiKey
      ? `${overview.aiSettings.provider} / ${overview.aiSettings.model}`
      : '尚未保存账号级 AI 配置';
  }, [overview]);

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
      setActiveSection('rooms');
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
      setActiveSection('rooms');
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
    setActiveSection('rooms');
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
      setActiveSection('rooms');
      setAuthTab('login');
      setAuthMessage('账号已注销。');
    } catch (error: any) {
      setProfileError(error?.response?.data?.message ?? '账号注销失败');
    } finally {
      setAccountBusy(false);
    }
  };

  const renderRoomWorkspace = () => (
    <DashboardCard
      eyebrow="Room Workspace"
      title="创建或加入房间"
      description="登录后你可以直接继续现有讨论，也可以发起一个新的房间。"
    >
      <div className="mb-5 inline-flex rounded-2xl bg-blue-50 p-1 border border-blue-100">
        {(['create', 'join'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setRoomTab(tab)}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              roomTab === tab
                ? 'bg-white text-blue-950 shadow-sm border border-blue-100/50'
                : 'text-blue-700/70 hover:text-blue-900'
            }`}
          >
            {tab === 'create' ? '创建房间' : '加入房间'}
          </button>
        ))}
      </div>

      {roomTab === 'create' ? (
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
      ) : (
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
      )}

      {roomError ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {roomError}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void (roomTab === 'create' ? handleCreateRoom() : handleJoinRoom())}
        disabled={roomBusy}
        className="mt-5 inline-flex rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {roomBusy
          ? '处理中...'
          : roomTab === 'create'
            ? '创建并进入房间'
            : '加入并继续讨论'}
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

  const renderAiSettings = () => (
    <DashboardCard
      eyebrow="AI Settings"
      title="账号级 AI 设置"
      description="保存后会跟随当前账号自动恢复，不需要每次重新输入。"
    >
      <AccountAiSettingsPanel onSaved={() => void refreshAccountData()} />
    </DashboardCard>
  );

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'ai':
        return renderAiSettings();
      case 'active':
        return renderActiveRooms();
      case 'history':
        return renderHistoryRooms();
      default:
        return renderRoomWorkspace();
    }
  };

  const sectionMeta: Record<
    DashboardSection,
    { label: string; description: string; icon: ComponentType<{ className?: string }> }
  > = {
    rooms: {
      label: '创建 / 加入房间',
      description: '创建新房间，或输入房间码快速加入。',
      icon: DoorOpen,
    },
    ai: {
      label: 'AI 设置',
      description: '为当前账号保存提供商、模型和 API Key。',
      icon: Sparkles,
    },
    active: {
      label: '正在参与的房间',
      description: '继续进入你当前仍在参与的讨论房间。',
      icon: Users,
    },
    history: {
      label: '14 天内的房间',
      description: '查看最近 14 天离开的房间记录并重新加入。',
      icon: Clock3,
    },
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

  const navItems: Array<{
    id: DashboardSection;
    label: string;
    count?: number;
    icon: ComponentType<{ className?: string }>;
  }> = [
    { id: 'rooms', label: '创建 / 加入房间', icon: PlusCircle },
    { id: 'ai', label: 'AI 设置', icon: Settings2 },
    { id: 'active', label: '正在参与的房间', icon: Users, count: overview?.activeRooms.length ?? 0 },
    { id: 'history', label: '14 天内的房间', icon: Clock3, count: overview?.roomHistory.length ?? 0 },
  ];

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_20%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.12),_transparent_24%),linear-gradient(135deg,_#eff6ff_0%,_#dbeafe_32%,_#ffffff_100%)] p-4 text-blue-950">
      <div className="mx-auto flex h-full max-w-[1600px] gap-4">
        <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden rounded-[32px] border border-blue-200/50 bg-white/90 p-5 text-blue-950 shadow-[0_28px_80px_rgba(30,58,138,0.1)] backdrop-blur">
          <div className="rounded-[28px] border border-blue-100 bg-blue-50/50 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-600">
              X-Thread Console
            </div>
            <div className="mt-4 flex items-start gap-4">
              <SidebarAvatar name={user.name} avatar={user.avatar} busy={avatarBusy} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xl font-black text-blue-950">{user.name}</div>
                <div className="mt-1 truncate text-sm text-blue-700/80">
                  {user.account ?? 'No account'}
                </div>
                {user.email ? (
                  <div className="mt-1 truncate text-xs text-blue-600/70">{user.email}</div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-2">
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
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ImagePlus className="h-4 w-4" />
                上传头像
              </button>
              {user.avatar ? (
                <button
                  type="button"
                  onClick={() => void handleClearAvatar()}
                  disabled={avatarBusy}
                  className="rounded-2xl border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  移除头像
                </button>
              ) : null}
            </div>

            {profileNotice ? (
              <div className="mt-4 rounded-2xl border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-800">
                {profileNotice}
              </div>
            ) : null}
            {profileError ? (
              <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600">
                {profileError}
              </div>
            ) : null}
          </div>

          <div className="mt-5 space-y-2">
            {navItems.map((item) => {
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
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                    active
                      ? 'bg-purple-600 text-white shadow-[0_18px_40px_rgba(147,51,234,0.3)]'
                      : 'bg-blue-50/50 text-blue-900 hover:bg-blue-100'
                  }`}
                >
                  <span className="inline-flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-semibold">{item.label}</span>
                  </span>
                  {item.count !== undefined ? (
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        active ? 'bg-purple-800/40 text-purple-50' : 'bg-blue-200/50 text-blue-800'
                      }`}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-3 rounded-[28px] border border-blue-100 bg-blue-50/50 p-4 text-sm text-blue-900">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-blue-600">AI Status</div>
              <div className="mt-2 font-semibold text-blue-950">{aiStatusText}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white px-3 py-3 shadow-sm border border-blue-100/50">
                <div className="text-xs uppercase tracking-[0.16em] text-blue-500">Active</div>
                <div className="mt-2 text-xl font-black text-blue-950">
                  {overviewBusy ? '...' : overview?.activeRooms.length ?? 0}
                </div>
              </div>
              <div className="rounded-2xl bg-white px-3 py-3 shadow-sm border border-blue-100/50">
                <div className="text-xs uppercase tracking-[0.16em] text-blue-500">History</div>
                <div className="mt-2 text-xl font-black text-blue-950">
                  {overviewBusy ? '...' : overview?.roomHistory.length ?? 0}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto space-y-2 pt-5">
            <button
              type="button"
              onClick={() => void refreshAccountData()}
              disabled={overviewBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${overviewBusy ? 'animate-spin' : ''}`} />
              刷新工作台
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-100/80 px-4 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-200/80"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
            <button
              type="button"
              onClick={() => void handleCancelAccount()}
              disabled={accountBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {accountBusy ? '注销中...' : '注销账号'}
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
