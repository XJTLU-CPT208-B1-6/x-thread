import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bot,
  DoorOpen,
  Gamepad2,
  Home,
  ImagePlus,
  Languages,
  LogOut,
  Menu,
  PlusCircle,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { AccountAiSettingsPanel } from '../components/AccountAiSettingsPanel';
import { CompanionSettingsPanel } from '../components/CompanionSettingsPanel';
import { GroupLobbyPanel } from '../components/GroupLobbyPanel';
import { PersonalityBadge } from '../components/PersonalityBadge';
import { SimpleLanguageToggle } from '../components/LanguageSwitcher';
import { accountService, authService, roomService, type AccountOverview } from '../services/api-client';
import { applyAuthSession, clearAuthSession, getStoredAuthToken, syncUserFromProfile } from '../lib/auth';
import { saveAiSettings } from '../lib/ai-settings';
import { getPersonalityTypeOptions, type PersonalityType } from '../lib/personality';
import { useLanguageStore } from '../stores/useLanguageStore';
import { useRoomStore } from '../stores/useRoomStore';
import { useUserStore } from '../stores/useUserStore';

type Section = 'home' | 'current' | 'create' | 'join' | 'lobby' | 'profile' | 'ai' | 'pets' | 'lang';

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Avatar read failed'));
    reader.readAsDataURL(file);
  });

const roomPath = (code: string, phase: string) => {
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

const initials = (value?: string | null) => {
  const source = value?.trim();
  return source ? source.slice(0, 2).toUpperCase() : 'XT';
};

const Card = ({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) => (
  <section className="rounded-[28px] border border-blue-200 bg-white/95 p-5 shadow-[0_24px_60px_rgba(30,58,138,0.08)]">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-blue-950">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-7 text-blue-800/70">{description}</p> : null}
      </div>
      {action}
    </div>
    <div className="mt-6">{children}</div>
  </section>
);

export default function HomeWorkspacePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { user } = useUserStore();
  const { setRoom, clearRoom } = useRoomStore();
  const { language, setLanguage } = useLanguageStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [section, setSection] = useState<Section>((searchParams.get('section') as Section | null) ?? 'home');
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [accountForm, setAccountForm] = useState({ account: '', nickname: '', personalityType: '' as '' | PersonalityType, password: '' });
  const [roomForm, setRoomForm] = useState({ topic: '', code: '', mode: 'ONSITE' as 'ONSITE' | 'REMOTE', maxMembers: 8, isPublic: true });
  const [profileForm, setProfileForm] = useState({ nickname: '', realName: '', xjtluEmail: '', personalityType: '' as '' | PersonalityType });
  const [authBusy, setAuthBusy] = useState(false);
  const [roomBusy, setRoomBusy] = useState(false);
  const [overviewBusy, setOverviewBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const copy = useMemo(
    () =>
      language === 'en'
        ? {
            home: 'Home',
            current: 'Current Rooms',
            create: 'Create Room',
            join: 'Join Room',
            lobby: 'Group Lobby',
            profile: 'Profile',
            ai: 'AI Settings',
            pets: 'Pet Settings',
            lang: 'Language',
            welcome: 'Welcome to X-Thread',
            account: 'Account',
            nickname: 'Nickname',
            password: 'Password',
            login: 'Login',
            register: 'Register',
            createTopic: 'Discussion Topic',
            roomCode: 'Room Code',
            roomMode: 'Room Mode',
            maxMembers: 'Max Members',
            publicLobby: 'Public in Group Lobby',
            saveProfile: 'Save Profile',
            refresh: 'Refresh',
            signOut: 'Sign Out',
            deleteAccount: 'Delete Account',
            noRooms: 'No rooms yet.',
            homeDesc: 'Quick access to rooms, settings, and the public lobby.',
            currentDesc: 'Resume rooms you are still participating in.',
            createDesc: 'Create a room and choose whether it appears in the public lobby.',
            joinDesc: 'Enter a room code to join an existing room.',
            profileDesc: 'Manage your personal info and avatar.',
            aiDesc: 'Configure the AI provider used by your account.',
            petsDesc: 'Manage the pets linked to your account.',
            langDesc: 'Switch the interface language instantly.',
            roomModeOnsite: 'On-site',
            roomModeRemote: 'Remote',
          }
        : {
            home: '首页',
            current: '当前房间',
            create: '创建房间',
            join: '加入房间',
            lobby: '组队大厅',
            profile: '个人资料',
            ai: 'AI 设置',
            pets: '宠物设置',
            lang: '语言',
            welcome: '欢迎来到 X-Thread',
            account: '账号',
            nickname: '昵称',
            password: '密码',
            login: '登录',
            register: '注册',
            createTopic: '讨论主题',
            roomCode: '房间码',
            roomMode: '房间模式',
            maxMembers: '人数上限',
            publicLobby: '公开到组队大厅',
            saveProfile: '保存资料',
            refresh: '刷新',
            signOut: '退出登录',
            deleteAccount: '注销账号',
            noRooms: '还没有房间。',
            homeDesc: '快速进入房间、设置和公开大厅。',
            currentDesc: '继续进入你仍在参与的房间。',
            createDesc: '创建房间，并选择是否出现在组队大厅。',
            joinDesc: '输入房间码加入已有房间。',
            profileDesc: '管理你的个人资料和头像。',
            aiDesc: '配置当前账号使用的 AI 供应商。',
            petsDesc: '管理绑定到当前账号的宠物。',
            langDesc: '即时切换界面语言。',
            roomModeOnsite: '线下',
            roomModeRemote: '远程',
          },
    [language],
  );

  const personalityOptions = getPersonalityTypeOptions(language);

  const sections = [
    { id: 'home' as const, label: copy.home, icon: Home },
    { id: 'current' as const, label: copy.current, icon: DoorOpen },
    { id: 'create' as const, label: copy.create, icon: PlusCircle },
    { id: 'join' as const, label: copy.join, icon: Users },
    { id: 'lobby' as const, label: copy.lobby, icon: Gamepad2 },
    { id: 'profile' as const, label: copy.profile, icon: User },
    { id: 'ai' as const, label: copy.ai, icon: Settings2 },
    { id: 'pets' as const, label: copy.pets, icon: Bot },
    { id: 'lang' as const, label: copy.lang, icon: Languages },
  ];

  const refreshOverview = async () => {
    if (!user?.id && !getStoredAuthToken()) {
      setOverview(null);
      return;
    }
    setOverviewBusy(true);
    try {
      const [nextOverview, nextAiSettings] = await Promise.all([accountService.getOverview(), accountService.getAiSettings()]);
      setOverview(nextOverview);
      syncUserFromProfile(nextOverview.user);
      saveAiSettings(nextAiSettings);
    } finally {
      setOverviewBusy(false);
    }
  };

  useEffect(() => {
    void refreshOverview();
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      setProfileForm({
        nickname: user.name ?? '',
        realName: user.realName ?? '',
        xjtluEmail: user.xjtluEmail ?? '',
        personalityType: user.personalityType ?? '',
      });
    }
  }, [user?.name, user?.realName, user?.xjtluEmail, user?.personalityType]);

  const goToRoom = async (code: string, phase: string) => {
    const result = await roomService.getRoomByCode(code);
    setRoom(result);
    navigate(roomPath(code, phase));
  };

  const handleLogin = async () => {
    setAuthBusy(true);
    setError('');
    try {
      const session = await authService.login({ account: accountForm.account.trim(), password: accountForm.password });
      applyAuthSession(session);
      await refreshOverview();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRegister = async () => {
    setAuthBusy(true);
    setError('');
    try {
      const session = await authService.register({ account: accountForm.account.trim(), nickname: accountForm.nickname.trim(), password: accountForm.password, personalityType: accountForm.personalityType || undefined });
      applyAuthSession(session);
      await refreshOverview();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCreateRoom = async () => {
    setRoomBusy(true);
    setError('');
    try {
      const result = await roomService.createRoom({ topic: roomForm.topic.trim(), mode: roomForm.mode, maxMembers: roomForm.maxMembers, isPublic: roomForm.isPublic });
      const room = result.room.room ?? result.room;
      setRoom(room);
      navigate(roomPath(room.code, room.phase));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed');
    } finally {
      setRoomBusy(false);
    }
  };

  const handleJoinRoom = async () => {
    setRoomBusy(true);
    setError('');
    try {
      const result = await roomService.joinRoom(roomForm.code.trim().toUpperCase());
      const room = result.room.room ?? result.room;
      setRoom(room);
      navigate(roomPath(room.code, room.phase));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed');
    } finally {
      setRoomBusy(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileBusy(true);
    setNotice('');
    setError('');
    try {
      const { user: nextUser } = await accountService.updateProfile({ nickname: profileForm.nickname, realName: profileForm.realName, xjtluEmail: profileForm.xjtluEmail, personalityType: profileForm.personalityType || undefined });
      syncUserFromProfile(nextUser);
      setNotice('OK');
      await refreshOverview();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed');
    } finally {
      setProfileBusy(false);
    }
  };

  const handleAvatarPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    try {
      const avatarDataUrl = await readFileAsDataUrl(file);
      const { user: nextUser } = await accountService.updateProfile({ avatarDataUrl });
      syncUserFromProfile(nextUser);
      await refreshOverview();
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    clearRoom();
    setOverview(null);
  };

  const handleCancelAccount = async () => {
    setAccountBusy(true);
    try {
      await accountService.cancelAccount();
      clearAuthSession();
      clearRoom();
      setOverview(null);
    } finally {
      setAccountBusy(false);
    }
  };

  const content = () => {
    switch (section) {
      case 'current':
        return <Card title={copy.current} description={copy.currentDesc}>{(overview?.activeRooms ?? []).length ? <div className="grid gap-4 md:grid-cols-2">{overview?.activeRooms.map((room) => <button key={room.roomId} type="button" onClick={() => void goToRoom(room.code, room.phase)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left"><div className="text-xs uppercase tracking-[0.22em] text-slate-500">{room.code}</div><div className="mt-1 text-lg font-bold text-slate-900">{room.topic}</div></button>)}</div> : <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">{copy.noRooms}</div>}</Card>;
      case 'create':
        return <Card title={copy.create} description={copy.createDesc}><div className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><label className="mb-2 block text-sm font-medium text-slate-700">{copy.createTopic}</label><input value={roomForm.topic} onChange={(event) => setRoomForm((current) => ({ ...current, topic: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></div><div><label className="mb-2 block text-sm font-medium text-slate-700">{copy.roomMode}</label><select value={roomForm.mode} onChange={(event) => setRoomForm((current) => ({ ...current, mode: event.target.value as 'ONSITE' | 'REMOTE' }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"><option value="ONSITE">{copy.roomModeOnsite}</option><option value="REMOTE">{copy.roomModeRemote}</option></select></div><div><label className="mb-2 block text-sm font-medium text-slate-700">{copy.maxMembers}</label><input type="number" min={2} max={20} value={roomForm.maxMembers} onChange={(event) => setRoomForm((current) => ({ ...current, maxMembers: Math.max(2, Math.min(20, Number(event.target.value) || 8)) }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></div><label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={roomForm.isPublic} onChange={(event) => setRoomForm((current) => ({ ...current, isPublic: event.target.checked }))} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" /><span className="font-semibold text-slate-900">{copy.publicLobby}</span></label></div>{error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div> : null}<button type="button" onClick={() => void handleCreateRoom()} disabled={roomBusy} className="mt-4 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{copy.create}</button></Card>;
      case 'join':
        return <Card title={copy.join} description={copy.joinDesc}><label className="mb-2 block text-sm font-medium text-slate-700">{copy.roomCode}</label><input value={roomForm.code} onChange={(event) => setRoomForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold uppercase tracking-[0.28em] outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />{error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div> : null}<button type="button" onClick={() => void handleJoinRoom()} disabled={roomBusy} className="mt-4 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{copy.join}</button></Card>;
      case 'lobby':
        return <GroupLobbyPanel />;
      case 'profile':
        return <Card title={copy.profile} description={copy.profileDesc} action={<SimpleLanguageToggle />}><div className="grid gap-4 md:grid-cols-2"><div><label className="mb-2 block text-sm font-medium text-slate-700">{copy.nickname}</label><input value={profileForm.nickname} onChange={(event) => setProfileForm((current) => ({ ...current, nickname: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></div><div><label className="mb-2 block text-sm font-medium text-slate-700">XJTLU Email</label><input value={profileForm.xjtluEmail} onChange={(event) => setProfileForm((current) => ({ ...current, xjtluEmail: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></div><div className="md:col-span-2"><label className="mb-2 block text-sm font-medium text-slate-700">{language === 'en' ? 'Personality Type' : '人格类型'}</label><div className="grid gap-3 sm:grid-cols-2">{personalityOptions.map((option) => <button key={option.value} type="button" onClick={() => setProfileForm((current) => ({ ...current, personalityType: option.value }))} className={`rounded-2xl border px-4 py-3 text-left transition ${profileForm.personalityType === option.value ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-blue-300 hover:bg-white'}`}><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{option.label}</span><PersonalityBadge value={option.value} /></div><div className="mt-1 text-xs text-slate-600">{option.description}</div></button>)}</div></div></div>{notice || error ? <div className={`mt-4 rounded-xl px-3 py-2 text-sm ${error ? 'border border-rose-200 bg-rose-50 text-rose-600' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || notice}</div> : null}<button type="button" onClick={() => void handleSaveProfile()} disabled={profileBusy} className="mt-4 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{copy.saveProfile}</button></Card>;
      case 'ai':
        return <Card title={copy.ai} description={copy.aiDesc}><AccountAiSettingsPanel onSaved={() => void refreshOverview()} /></Card>;
      case 'pets':
        return <Card title={copy.pets} description={copy.petsDesc}><CompanionSettingsPanel companions={overview?.companions ?? []} onChanged={() => refreshOverview()} /></Card>;
      case 'lang':
        return <Card title={copy.lang} description={copy.langDesc}><div className="flex items-center gap-4"><span className={`text-sm font-semibold ${language === 'zh' ? 'text-blue-600' : 'text-slate-400'}`}>中文</span><button type="button" onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')} className={`relative h-8 w-14 rounded-full transition ${language === 'en' ? 'bg-blue-600' : 'bg-slate-200'}`}><span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${language === 'en' ? 'left-7' : 'left-1'}`} /></button><span className={`text-sm font-semibold ${language === 'en' ? 'text-blue-600' : 'text-slate-400'}`}>English</span></div></Card>;
      case 'home':
      default:
        return <Card title={copy.home} description={copy.homeDesc}><div className="grid gap-4 md:grid-cols-3"><div className="rounded-3xl bg-blue-50 p-5"><div className="text-sm font-semibold text-blue-700">{copy.current}</div><div className="mt-3 text-3xl font-black text-blue-950">{overview?.activeRooms.length ?? 0}</div></div><div className="rounded-3xl bg-emerald-50 p-5"><div className="text-sm font-semibold text-emerald-700">{copy.lobby}</div><div className="mt-3 text-sm leading-6 text-emerald-950">{copy.homeDesc}</div></div><div className="rounded-3xl bg-amber-50 p-5"><div className="text-sm font-semibold text-amber-700">{copy.pets}</div><div className="mt-3 text-sm leading-6 text-amber-950">{copy.petsDesc}</div></div></div></Card>;
    }
  };

  if (!user) {
    return <div className="min-h-[100dvh] bg-[linear-gradient(135deg,_#eff6ff_0%,_#dbeafe_48%,_#ffffff_100%)] px-4 py-8"><div className="mx-auto flex max-w-lg flex-col gap-8"><div className="text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 text-2xl font-black text-white shadow-xl">XT</div><h1 className="mt-4 text-3xl font-black tracking-tight text-blue-950">{copy.welcome}</h1></div><section className="rounded-[34px] border border-blue-200/60 bg-white/95 p-8 shadow-[0_32px_90px_rgba(30,58,138,0.12)]"><div className="mb-6 flex rounded-2xl bg-blue-50 p-1 border border-blue-100">{(['login', 'register'] as const).map((tab) => <button key={tab} type="button" onClick={() => setAuthTab(tab)} className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${authTab === tab ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-700/70 hover:text-blue-900'}`}>{tab === 'login' ? copy.login : copy.register}</button>)}</div><div className="space-y-4"><div><label className="mb-2 block text-sm font-medium text-blue-950">{copy.account}</label><input value={accountForm.account} onChange={(event) => setAccountForm((current) => ({ ...current, account: event.target.value }))} className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></div>{authTab === 'register' ? <div><label className="mb-2 block text-sm font-medium text-blue-950">{copy.nickname}</label><input value={accountForm.nickname} onChange={(event) => setAccountForm((current) => ({ ...current, nickname: event.target.value }))} className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></div> : null}<div><label className="mb-2 block text-sm font-medium text-blue-950">{copy.password}</label><input type="password" value={accountForm.password} onChange={(event) => setAccountForm((current) => ({ ...current, password: event.target.value }))} className="w-full rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></div>{error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}<button type="button" onClick={() => void (authTab === 'login' ? handleLogin() : handleRegister())} disabled={authBusy} className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">{authBusy ? '...' : authTab === 'login' ? copy.login : copy.register}</button></div></section></div></div>;
  }

  return <div className="min-h-[100dvh] bg-[linear-gradient(135deg,_#eff6ff_0%,_#dbeafe_48%,_#ffffff_100%)] p-2 text-blue-950 md:p-4"><div className="mx-auto flex min-h-[calc(100dvh-1rem)] max-w-[1600px] gap-4 md:min-h-[calc(100dvh-2rem)]"><div className={`fixed inset-0 z-30 bg-slate-950/45 transition md:hidden ${sidebarOpen ? 'block' : 'hidden'}`} onClick={() => setSidebarOpen(false)} /><aside className={`fixed inset-y-2 left-2 z-40 flex w-[min(82vw,320px)] flex-col overflow-hidden rounded-[28px] border border-slate-200/60 bg-white text-slate-800 shadow-[0_20px_60px_rgba(15,23,42,0.16)] transition-transform md:static md:w-[280px] md:shrink-0 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-[110%]'}`}><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 md:hidden"><div className="text-sm font-semibold text-slate-900">X-Thread</div><button type="button" onClick={() => setSidebarOpen(false)} className="rounded-xl border border-slate-200 p-2 text-slate-500"><X className="h-4 w-4" /></button></div><div className="px-4 pt-4 pb-3 border-b border-slate-100"><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400 mb-3">{copy.welcome}</div><div className="flex items-center gap-3"><div className="relative h-16 w-16 overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-sm">{user.avatar ? <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-400 via-blue-500 to-cyan-500 text-xl font-black text-white">{initials(user.name)}</div>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><div className="truncate text-sm font-semibold text-slate-800">{user.name}</div><PersonalityBadge value={user.personalityType ?? null} /></div><div className="truncate text-xs text-slate-400 mt-0.5">{user.account ?? copy.account}</div></div><button type="button" onClick={() => fileInputRef.current?.click()} disabled={avatarBusy} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-blue-600 disabled:opacity-50"><ImagePlus className="h-3.5 w-3.5" /></button></div><input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif" onChange={(event) => void handleAvatarPick(event)} className="hidden" /></div><div className="flex-1 overflow-y-auto px-2 py-2">{sections.map((item) => { const Icon = item.icon; const active = section === item.id; return <button key={item.id} type="button" onClick={() => { setSection(item.id); setSidebarOpen(false); }} className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-all ${active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><span className="inline-flex items-center gap-2.5"><Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} /><span className="text-[13px] font-medium">{item.label}</span></span></button>; })}</div><div className="border-t border-slate-100 px-3 py-3 space-y-1.5"><button type="button" onClick={() => void refreshOverview()} disabled={overviewBusy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${overviewBusy ? 'animate-spin' : ''}`} />{copy.refresh}</button><button type="button" onClick={handleLogout} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600"><LogOut className="h-3.5 w-3.5" />{copy.signOut}</button><button type="button" onClick={() => void handleCancelAccount()} disabled={accountBusy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />{copy.deleteAccount}</button></div></aside><main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-blue-200/60 bg-white/95 shadow-[0_32px_90px_rgba(30,58,138,0.08)] backdrop-blur"><div className="flex items-center justify-between border-b border-blue-100 px-4 py-4 bg-blue-50/40 md:hidden"><button type="button" onClick={() => setSidebarOpen(true)} className="rounded-xl border border-blue-200 bg-white p-2 text-blue-700"><Menu className="h-5 w-5" /></button><div className="truncate text-sm font-semibold text-blue-950">{sections.find((item) => item.id === section)?.label ?? copy.home}</div><div className="w-9" /></div><div className="hidden border-b border-blue-100 px-8 py-6 bg-blue-50/30 md:block"><div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">{sections.find((item) => item.id === section)?.label ?? copy.home}</div><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-black tracking-tight text-blue-950">{sections.find((item) => item.id === section)?.label ?? copy.home}</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-blue-800/70">{sections.find((item) => item.id === section)?.id === 'home' ? copy.homeDesc : ''}</p></div><div className="inline-flex items-center gap-2 rounded-full bg-blue-100/80 px-4 py-2 text-sm font-medium text-blue-800"><Sparkles className="h-4 w-4 text-blue-600" />{copy.home}</div></div></div><div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 bg-white/50 md:px-8 md:py-8">{content()}</div></main></div></div>;
}

