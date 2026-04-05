import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function HomeDashboardPageV3() {
  const navigate = useNavigate();
  const { setRoom, clearRoom } = useRoomStore();
  const { user } = useUserStore();
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [roomTab, setRoomTab] = useState<'create' | 'join'>('create');
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
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [roomError, setRoomError] = useState('');

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
      setAuthError(error?.response?.data?.message ?? '账号状态失效，请重新登录');
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
    setAuthMessage('');
    setRoomError('');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(135deg,_#07111f_0%,_#134e4a_42%,_#f8fafc_100%)] px-4 py-8 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[32px] border border-white/20 bg-white/88 shadow-[0_32px_80px_rgba(15,23,42,0.18)] backdrop-blur">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="border-b border-slate-200/70 bg-[linear-gradient(135deg,_rgba(15,118,110,0.12),_rgba(14,165,233,0.06),_rgba(255,255,255,0.96))] p-8 lg:border-b-0 lg:border-r">
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">X-Thread Account Workspace</div>
              <h1 className="mt-4 max-w-2xl text-4xl font-black tracking-tight text-slate-900">账号工作台、AI 配置与房间历史</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">现在注册不再需要邮箱验证码。登录后，你的 AI 配置、已加入房间历史和当前活跃房间都会跟随账号同步。</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-teal-100 bg-white px-5 py-4 shadow-sm"><div className="text-xs uppercase tracking-[0.22em] text-teal-600">账号注册</div><div className="mt-2 text-lg font-semibold text-slate-900">账号 / 昵称 / 密码</div><div className="mt-2 text-sm text-slate-500">注册流程改为直接创建账号，不再强制邮箱验证。</div></div>
                <div className="rounded-3xl border border-sky-100 bg-white px-5 py-4 shadow-sm"><div className="text-xs uppercase tracking-[0.22em] text-sky-600">AI 配置</div><div className="mt-2 text-lg font-semibold text-slate-900">账号级恢复</div><div className="mt-2 text-sm text-slate-500">API Key、供应商、模型和自定义 OpenAI-compatible 地址都会跟随账号保存。</div></div>
                <div className="rounded-3xl border border-amber-100 bg-white px-5 py-4 shadow-sm"><div className="text-xs uppercase tracking-[0.22em] text-amber-600">历史保留</div><div className="mt-2 text-lg font-semibold text-slate-900">14 天房间记录</div><div className="mt-2 text-sm text-slate-500">离开或房间解散后，历史记录仍会在账号下保留 14 天。</div></div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              {!user ? (
                <>
                  <div className="mb-6 flex rounded-2xl bg-slate-100 p-1">
                    {(['login', 'register'] as const).map((tab) => (
                      <button key={tab} type="button" onClick={() => setAuthTab(tab)} className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${authTab === tab ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{tab === 'login' ? '账号登录' : '账号注册'}</button>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">账号</label>
                      <input value={accountForm.account} onChange={(event) => updateAccountForm({ account: event.target.value })} placeholder="例如 xthread_team01" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100" />
                    </div>
                    {authTab === 'register' && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">昵称</label>
                        <input value={accountForm.nickname} onChange={(event) => updateAccountForm({ nickname: event.target.value })} placeholder="房间内显示名称" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100" />
                      </div>
                    )}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">密码</label>
                      <input type="password" value={accountForm.password} onChange={(event) => updateAccountForm({ password: event.target.value })} placeholder={authTab === 'login' ? '输入账号密码' : '至少 6 位'} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100" />
                    </div>
                    {authMessage && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{authMessage}</div>}
                    {authError && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{authError}</div>}
                    <button type="button" onClick={() => void (authTab === 'login' ? handleLogin() : handleRegister())} disabled={authBusy} className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">{authBusy ? '处理中...' : authTab === 'login' ? '登录并恢复账号' : '注册并进入工作台'}</button>
                  </div>
                </>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-[28px] bg-slate-950 px-6 py-6 text-white">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.22em] text-teal-300">Current Account</div>
                        <div className="mt-2 text-2xl font-black">{user.name}</div>
                        <div className="mt-2 space-y-1 text-sm text-slate-300"><div>账号：{user.account ?? '--'}</div>{user.email ? <div>邮箱：{user.email}</div> : null}</div>
                      </div>
                      <div className="flex gap-3">
                        <button type="button" onClick={() => navigate('/settings/ai')} className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">AI 设置</button>
                        <button type="button" onClick={handleLogout} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">退出登录</button>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-white/8 px-4 py-3"><div className="text-xs uppercase tracking-[0.18em] text-teal-200">AI 配置</div><div className="mt-2 text-sm font-semibold text-white">{aiStatusText}</div></div>
                      <div className="rounded-2xl bg-white/8 px-4 py-3"><div className="text-xs uppercase tracking-[0.18em] text-teal-200">活跃房间</div><div className="mt-2 text-sm font-semibold text-white">{overviewBusy ? '同步中...' : overview?.activeRooms.length ?? 0}</div></div>
                      <div className="rounded-2xl bg-white/8 px-4 py-3"><div className="text-xs uppercase tracking-[0.18em] text-teal-200">历史房间</div><div className="mt-2 text-sm font-semibold text-white">{overviewBusy ? '同步中...' : overview?.roomHistory.length ?? 0}</div></div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex rounded-2xl bg-slate-100 p-1">
                      {(['create', 'join'] as const).map((tab) => (
                        <button key={tab} type="button" onClick={() => setRoomTab(tab)} className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${roomTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{tab === 'create' ? '创建房间' : '加入房间'}</button>
                      ))}
                    </div>
                    {roomTab === 'create' ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2"><label className="mb-2 block text-sm font-medium text-slate-700">讨论主题</label><input value={roomForm.topic} onChange={(event) => updateRoomForm({ topic: event.target.value })} placeholder="例如：AI 如何改变工程协作" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100" /></div>
                        <div><label className="mb-2 block text-sm font-medium text-slate-700">房间模式</label><select value={roomForm.mode} onChange={(event) => updateRoomForm({ mode: event.target.value as 'ONSITE' | 'REMOTE' })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100"><option value="ONSITE">线下协作</option><option value="REMOTE">远程协作</option></select></div>
                        <div><label className="mb-2 block text-sm font-medium text-slate-700">人数上限</label><input type="number" min={2} max={20} value={roomForm.maxMembers} onChange={(event) => updateRoomForm({ maxMembers: Math.max(2, Math.min(20, Number(event.target.value) || 8)) })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100" /></div>
                      </div>
                    ) : (
                      <div><label className="mb-2 block text-sm font-medium text-slate-700">房间码</label><input value={roomForm.code} onChange={(event) => updateRoomForm({ code: event.target.value.toUpperCase() })} placeholder="输入 6 位房间码" maxLength={6} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold uppercase tracking-[0.28em] outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100" /></div>
                    )}
                    {roomError && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{roomError}</div>}
                    <button type="button" onClick={() => void (roomTab === 'create' ? handleCreateRoom() : handleJoinRoom())} disabled={roomBusy} className="mt-5 w-full rounded-2xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60">{roomBusy ? '处理中...' : roomTab === 'create' ? '创建并进入房间' : '加入并继续讨论'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {user && (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[28px] border border-white/25 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur">
              <div className="flex items-center justify-between"><div><div className="text-xs uppercase tracking-[0.22em] text-teal-700">Active Rooms</div><h2 className="mt-2 text-2xl font-black text-slate-900">正在参与的房间</h2></div><button type="button" onClick={() => void refreshAccountData()} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">刷新</button></div>
              <div className="mt-5 space-y-3">
                {overviewBusy && <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">正在同步当前账号下的活跃房间...</div>}
                {!overviewBusy && (overview?.activeRooms.length ?? 0) === 0 && <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">当前账号还没有活跃房间。</div>}
                {overview?.activeRooms.map((room) => (
                  <div key={`${room.roomId}:${room.status}`} className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs uppercase tracking-[0.18em] text-slate-400">{room.code}</div><div className="mt-2 text-lg font-bold text-slate-900">{room.topic}</div></div><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">{phaseLabelMap[room.phase] ?? room.phase}</span></div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2"><div>角色：{room.role === 'OWNER' ? '房主' : '成员'}</div><div>人数：{room.memberCount}/{room.maxMembers}</div><div>最近在线：{formatTime(room.lastSeenAt)}</div><div>模式：{room.mode === 'REMOTE' ? '远程' : '线下'}</div></div>
                    <button type="button" onClick={() => navigate(resolveRoomPath(room))} className="mt-4 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">继续进入</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/25 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur">
              <div><div className="text-xs uppercase tracking-[0.22em] text-amber-700">Room History</div><h2 className="mt-2 text-2xl font-black text-slate-900">14 天内的历史房间</h2></div>
              <div className="mt-5 space-y-3">
                {!overviewBusy && (overview?.roomHistory.length ?? 0) === 0 && <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">还没有历史房间记录。</div>}
                {overview?.roomHistory.map((room) => (
                  <div key={`${room.roomId}:${room.leftAt ?? room.joinedAt}`} className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs uppercase tracking-[0.18em] text-slate-400">{room.code}</div><div className="mt-2 text-lg font-bold text-slate-900">{room.topic}</div></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{room.leftAt ? `离开于 ${formatTime(room.leftAt)}` : '历史记录'}</span></div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2"><div>首次加入：{formatTime(room.joinedAt)}</div><div>最近在线：{formatTime(room.lastSeenAt)}</div><div>阶段：{phaseLabelMap[room.phase] ?? room.phase}</div><div>模式：{room.mode === 'REMOTE' ? '远程' : '线下'}</div></div>
                    <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => navigate(`/room/${room.code}/history`)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">查看历史</button><button type="button" onClick={() => void handleJoinRoom(room.code)} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">重新加入</button></div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
