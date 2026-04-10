import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import { PersonalityBadge } from '../components/PersonalityBadge';
import { useSocket } from '../hooks/useSocket';
import { accountService, roomService } from '../services/api-client';
import { socketService } from '../services/socket-service';
import { useLanguageStore } from '../stores/useLanguageStore';
import { useRoomStore } from '../stores/useRoomStore';
import { useUserStore } from '../stores/useUserStore';
import type { CompanionProfile } from '../types/companion';
import type { RoomMember } from '../types/room';

const getMemberInitial = (member: RoomMember) => (member.nickname || '?').trim().charAt(0).toUpperCase();

export default function LobbyPageV2Active() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { language } = useLanguageStore();
  const copy = useMemo(
    () =>
      language === 'en'
        ? {
            waiting: 'Waiting for members',
            roomCode: 'Room Code',
            remote: 'Remote Collaboration',
            onsite: 'On-site Collaboration',
            host: 'Host',
            hostMissing: 'Host info unavailable',
            hostDesc: 'The host can decide whether to show this room in the public lobby and which pets enter the room.',
            publicOn: 'Public in Lobby',
            publicOff: 'Hidden from Lobby',
            publicDesc: 'Toggle whether this room appears in the public group lobby before the room is dissolved.',
            savePublicFailed: 'Failed to update lobby visibility',
            petsTitle: 'Room Pets',
            petsDesc: 'Select multiple pets to enter the room, then choose which one is currently active. Members can still mention any selected pet directly.',
            chooseFirst: 'Select at least one pet first',
            savePets: 'Save Room Pets',
            savingPets: 'Saving...',
            savePetsFailed: 'Failed to update room pets',
            ownerOnly: 'Only the host can change room pets and public lobby visibility.',
            members: 'Current Members',
            online: 'Online',
            owner: 'Owner',
            self: 'You',
            member: 'Member',
            enter: 'Enter Discussion',
            dissolve: 'Dissolve Room',
            leave: 'Leave Room',
            dissolveConfirm: 'Dissolving the room removes every member. Continue?',
            dissolveFailed: 'Failed to dissolve room',
            leaveFailed: 'Failed to leave room',
            roomHint: 'Members can leave at any time. Room history remains available for a limited time after leaving.',
            activePet: 'Active Pet',
            selectPet: 'Selected Pets',
          }
        : {
            waiting: '等待成员就位',
            roomCode: '房间码',
            remote: '远程协作',
            onsite: '线下协作',
            host: '房主',
            hostMissing: '未获取到房主信息',
            hostDesc: '房主可以决定房间是否公开到组队大厅，以及哪些宠物进入房间。',
            publicOn: '公开到大厅',
            publicOff: '仅房间码可见',
            publicDesc: '在房间未解散前，房主可以随时切换是否公开到组队大厅。',
            savePublicFailed: '更新大厅公开状态失败',
            petsTitle: '房间宠物',
            petsDesc: '可一次选择多只宠物进入房间，再指定当前活跃宠物。成员仍然可以直接 @ 任意已选宠物。',
            chooseFirst: '请先选择至少一只宠物',
            savePets: '保存房间宠物',
            savingPets: '保存中...',
            savePetsFailed: '更新房间宠物失败',
            ownerOnly: '只有房主可以修改房间宠物和大厅公开状态。',
            members: '当前成员',
            online: '在线',
            owner: '房主',
            self: '你',
            member: '成员',
            enter: '进入讨论',
            dissolve: '解散房间',
            leave: '退出房间',
            dissolveConfirm: '解散房间后，所有成员会被移出。是否继续？',
            dissolveFailed: '解散房间失败',
            leaveFailed: '退出房间失败',
            roomHint: '成员可以主动退出房间。退出后，房间历史会保留一段时间，便于后续回看。',
            activePet: '当前活跃宠物',
            selectPet: '已选宠物',
          },
    [language],
  );

  const getMemberBadge = (member: RoomMember, currentUserId?: string) => {
    if (member.role === 'OWNER') return copy.owner;
    if (member.userId === currentUserId) return copy.self;
    return copy.member;
  };

  const { currentRoom, members, setRoom, clearRoom } = useRoomStore();
  const { user } = useUserStore();
  const [actionBusy, setActionBusy] = useState(false);
  const [botBusy, setBotBusy] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [companions, setCompanions] = useState<CompanionProfile[]>([]);
  const [selectedCompanionIds, setSelectedCompanionIds] = useState<string[]>([]);
  const [activeCompanionId, setActiveCompanionId] = useState('');
  const [error, setError] = useState('');

  useSocket(currentRoom?.id);

  useEffect(() => {
    if (!code) {
      navigate('/');
      return;
    }
    let cancelled = false;
    const loadRoom = async () => {
      try {
        const room = await roomService.getRoomByCode(code);
        if (!cancelled) setRoom(room);
      } catch {
        if (!cancelled) navigate('/');
      }
    };
    void loadRoom();
    const handleRoomDissolved = (event: Event) => {
      const payload = (event as CustomEvent<{ roomId?: string }>).detail;
      if (payload?.roomId && payload.roomId === currentRoom?.id) {
        clearRoom();
        navigate('/');
      }
    };
    window.addEventListener('x-thread-room-dissolved', handleRoomDissolved);
    return () => {
      cancelled = true;
      window.removeEventListener('x-thread-room-dissolved', handleRoomDissolved);
    };
  }, [code, currentRoom?.id, clearRoom, navigate, setRoom]);

  const visibleMembers = useMemo(
    () =>
      (currentRoom?.members?.length ? currentRoom.members : members)
        .slice()
        .sort((a, b) => (a.role === b.role ? a.nickname.localeCompare(b.nickname) : a.role === 'OWNER' ? -1 : 1)),
    [currentRoom?.members, members],
  );

  const host = visibleMembers.find((member) => member.role === 'OWNER');
  const currentMember = visibleMembers.find((member) => member.userId === user?.id);
  const isOwner = currentMember?.role === 'OWNER';

  useEffect(() => {
    let cancelled = false;
    if (!isOwner) {
      setCompanions([]);
      return () => {
        cancelled = true;
      };
    }
    const loadCompanions = async () => {
      try {
        const profiles = await accountService.getCompanions();
        if (!cancelled) setCompanions(profiles);
      } catch {
        if (!cancelled) setError(language === 'en' ? 'Failed to load pets' : '加载宠物列表失败');
      }
    };
    void loadCompanions();
    return () => {
      cancelled = true;
    };
  }, [isOwner, language]);

  useEffect(() => {
    const roomCompanionIds = currentRoom?.activeCompanions?.map((companion) => companion.id) ?? [];
    setSelectedCompanionIds(roomCompanionIds);
    setActiveCompanionId(currentRoom?.botProfileId ?? roomCompanionIds[0] ?? '');
  }, [currentRoom?.activeCompanions, currentRoom?.botProfileId]);

  const toggleCompanion = (companionId: string) => {
    setSelectedCompanionIds((current) => {
      const next = current.includes(companionId) ? current.filter((id) => id !== companionId) : [...current, companionId];
      if (!next.includes(activeCompanionId)) {
        setActiveCompanionId(next[0] ?? '');
      }
      return next;
    });
  };

  const handleSaveCompanions = async () => {
    if (!currentRoom?.id || botBusy) return;
    if (selectedCompanionIds.length === 0) {
      setError(copy.chooseFirst);
      return;
    }
    setBotBusy(true);
    setError('');
    try {
      const result = await roomService.updateCompanionBot(currentRoom.id, {
        enabled: true,
        profileIds: selectedCompanionIds,
        activeProfileId: activeCompanionId || selectedCompanionIds[0],
      });
      setRoom(result.room);
    } catch (botError: any) {
      setError(botError?.response?.data?.message ?? copy.savePetsFailed);
    } finally {
      setBotBusy(false);
    }
  };

  const handleToggleVisibility = async () => {
    if (!currentRoom?.id || visibilityBusy) return;
    setVisibilityBusy(true);
    setError('');
    try {
      const result = await roomService.updateRoom(currentRoom.id, {
        isPublic: !currentRoom.isPublic,
      });
      setRoom(result.room);
    } catch (visibilityError: any) {
      setError(visibilityError?.response?.data?.message ?? copy.savePublicFailed);
    } finally {
      setVisibilityBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!currentRoom?.id || actionBusy) return;
    setActionBusy(true);
    setError('');
    try {
      await roomService.leaveRoom(currentRoom.id);
      socketService.leaveRoom(currentRoom.id);
      clearRoom();
      navigate('/');
    } catch (leaveError: any) {
      setError(leaveError?.response?.data?.message ?? copy.leaveFailed);
    } finally {
      setActionBusy(false);
    }
  };

  const handleDissolve = async () => {
    if (!currentRoom?.id || actionBusy) return;
    if (!window.confirm(copy.dissolveConfirm)) return;
    setActionBusy(true);
    setError('');
    try {
      await roomService.dissolveRoom(currentRoom.id);
      clearRoom();
      navigate('/');
    } catch (dissolveError: any) {
      setError(dissolveError?.response?.data?.message ?? copy.dissolveFailed);
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[linear-gradient(160deg,_#eff6ff_0%,_#f8fafc_48%,_#dbeafe_100%)] p-4 md:p-6">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-6xl items-center justify-center md:min-h-[calc(100dvh-3rem)]">
        <div className="grid w-full gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[32px] border border-white/60 bg-white/88 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur md:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Room Lobby</div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{copy.waiting}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>{copy.roomCode}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-mono font-semibold text-slate-900">{code}</span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{currentRoom?.mode === 'REMOTE' ? copy.remote : copy.onsite}</span>
              <span className={`rounded-full px-3 py-1 ${currentRoom?.isPublic ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{currentRoom?.isPublic ? copy.publicOn : copy.publicOff}</span>
            </div>

            <div className="mt-8 rounded-3xl border border-blue-100 bg-blue-50/80 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">{copy.host}</div>
              <div className="mt-3 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">{host ? getMemberInitial(host) : '?'}</div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-900">
                    <span>{host?.nickname ?? copy.hostMissing}</span>
                    <PersonalityBadge value={host?.personalityType ?? null} />
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{copy.hostDesc}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-800">{copy.roomHint}</div>

            <div className="mt-6 space-y-6 rounded-3xl border border-slate-200 bg-slate-50/90 p-5">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{copy.publicOn}</div>
                    <p className="mt-1 text-sm text-slate-500">{copy.publicDesc}</p>
                  </div>
                  {isOwner ? (
                    <button type="button" onClick={() => void handleToggleVisibility()} disabled={visibilityBusy} className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${currentRoom?.isPublic ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'} disabled:opacity-60`}>
                      {currentRoom?.isPublic ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      {currentRoom?.isPublic ? copy.publicOn : copy.publicOff}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{copy.petsTitle}</div>
                    <p className="mt-1 text-sm text-slate-500">{copy.petsDesc}</p>
                  </div>
                  {activeCompanionId ? (
                    <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700">{copy.activePet}: @{companions.find((item) => item.id === activeCompanionId)?.name ?? currentRoom?.botProfile?.name ?? ''}</div>
                  ) : null}
                </div>

                {isOwner ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {companions.map((companion) => {
                        const selected = selectedCompanionIds.includes(companion.id);
                        const active = activeCompanionId === companion.id;
                        return (
                          <button key={companion.id} type="button" onClick={() => toggleCompanion(companion.id)} className={`rounded-3xl border px-4 py-4 text-left transition ${selected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-300'}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{companion.emoji}</span>
                                <div>
                                  <div className="font-semibold text-slate-900">{companion.name}</div>
                                  <div className="text-xs text-slate-500">{companion.styleGuide}</div>
                                </div>
                              </div>
                              {active ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">{copy.activePet}</span> : null}
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-600">{companion.description}</p>
                          </button>
                        );
                      })}
                    </div>

                    {selectedCompanionIds.length > 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.selectPet}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedCompanionIds.map((companionId) => {
                            const companion = companions.find((item) => item.id === companionId);
                            if (!companion) return null;
                            return (
                              <button key={companion.id} type="button" onClick={() => setActiveCompanionId(companion.id)} className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${activeCompanionId === companion.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                                {companion.emoji} {companion.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    <button type="button" onClick={() => void handleSaveCompanions()} disabled={botBusy || companions.length === 0} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                      {botBusy ? copy.savingPets : copy.savePets}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">{copy.ownerOnly}</div>
                )}
              </div>
            </div>

            {error ? <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={() => navigate(`/room/${code}/discuss`)} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">{copy.enter}</button>
              {isOwner ? (
                <button type="button" onClick={() => void handleDissolve()} disabled={actionBusy} className="rounded-2xl border border-rose-200 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60">{copy.dissolve}</button>
              ) : (
                <button type="button" onClick={() => void handleLeave()} disabled={actionBusy} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">{copy.leave}</button>
              )}
            </div>
          </section>

          <section className="rounded-[32px] border border-white/60 bg-white/92 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-8">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-slate-900">{copy.members}</h2>
              <span className="text-sm text-slate-500">{visibleMembers.length}/{currentRoom?.maxMembers ?? '--'}</span>
            </div>

            <ul className="space-y-3">
              {visibleMembers.map((member) => (
                <li key={member.userId} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">{getMemberInitial(member)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate font-medium text-slate-900">{member.nickname}</div>
                      <PersonalityBadge value={member.personalityType ?? null} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{member.status === 'ACTIVE' ? copy.online : member.status}</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${member.role === 'OWNER' ? 'bg-blue-100 text-blue-700' : member.userId === user?.id ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>{getMemberBadge(member, user?.id)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

