import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { roomService } from '../services/api-client';
import { socketService } from '../services/socket-service';
import { useRoomStore } from '../stores/useRoomStore';
import { useUserStore } from '../stores/useUserStore';
import { RoomMember } from '../types/room';

const getMemberBadge = (member: RoomMember, currentUserId?: string) => {
  if (member.role === 'OWNER') {
    return '房主';
  }

  if (member.userId === currentUserId) {
    return '你';
  }

  return '成员';
};

const getMemberInitial = (member: RoomMember) =>
  (member.nickname || '?').trim().charAt(0).toUpperCase();

export default function LobbyPageV2() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { currentRoom, members, setRoom, clearRoom } = useRoomStore();
  const { user } = useUserStore();
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) {
      navigate('/');
      return;
    }

    let cancelled = false;

    const loadRoom = async () => {
      try {
        const room = await roomService.getRoomByCode(code);
        if (!cancelled) {
          setRoom(room);
        }
      } catch (loadError) {
        console.error('Failed to load lobby room:', loadError);
        if (!cancelled) {
          navigate('/');
        }
      }
    };

    void loadRoom();

    const handleRoomDissolved = (event: Event) => {
      const payload = (event as CustomEvent<{ roomId?: string; topic?: string }>).detail;
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
        .sort((a, b) => {
          if (a.role === b.role) {
            return a.nickname.localeCompare(b.nickname);
          }

          return a.role === 'OWNER' ? -1 : 1;
        }),
    [currentRoom?.members, members],
  );

  const host = visibleMembers.find((member) => member.role === 'OWNER');
  const currentMember = visibleMembers.find((member) => member.userId === user?.id);
  const isOwner = currentMember?.role === 'OWNER';

  const handleLeave = async () => {
    if (!currentRoom?.id || actionBusy) {
      return;
    }

    setActionBusy(true);
    setError('');
    try {
      await roomService.leaveRoom(currentRoom.id);
      socketService.leaveRoom(currentRoom.id);
      clearRoom();
      navigate('/');
    } catch (leaveError: any) {
      setError(leaveError?.response?.data?.message ?? '退出房间失败');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDissolve = async () => {
    if (!currentRoom?.id || actionBusy) {
      return;
    }

    const confirmed = window.confirm('解散房间后，所有成员会被移出，历史记录仅保留 14 天。是否继续？');
    if (!confirmed) {
      return;
    }

    setActionBusy(true);
    setError('');
    try {
      await roomService.dissolveRoom(currentRoom.id);
      clearRoom();
      navigate('/');
    } catch (dissolveError: any) {
      setError(dissolveError?.response?.data?.message ?? '解散房间失败');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,_#eff6ff_0%,_#f8fafc_48%,_#dbeafe_100%)] p-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[32px] border border-white/60 bg-white/88 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Room Lobby</div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900">等待成员就位</h1>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>房间码</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-mono font-semibold text-slate-900">
                {code}
              </span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                {currentRoom?.mode === 'REMOTE' ? '远程协作' : '线下协作'}
              </span>
            </div>

            <div className="mt-8 rounded-3xl border border-blue-100 bg-blue-50/80 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">房主</div>
              <div className="mt-3 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                  {host ? getMemberInitial(host) : '?'}
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-900">
                    {host?.nickname ?? '未获取到房主信息'}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    房主可以解散房间，AI 导图功能也只对房主开放。
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              成员可以主动退出房间。退出后房间历史保留 14 天，共享文件下载保留 7 天。
            </div>

            {error && (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate(`/room/${code}/discuss`)}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                进入讨论
              </button>
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => void handleDissolve()}
                  disabled={actionBusy}
                  className="rounded-2xl border border-rose-200 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  解散房间
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleLeave()}
                  disabled={actionBusy}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  退出房间
                </button>
              )}
            </div>
          </section>

          <section className="rounded-[32px] border border-white/60 bg-white/92 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-slate-900">当前成员</h2>
              <span className="text-sm text-slate-500">
                {visibleMembers.length}/{currentRoom?.maxMembers ?? '--'}
              </span>
            </div>

            <ul className="space-y-3">
              {visibleMembers.map((member) => (
                <li key={member.userId} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">
                    {getMemberInitial(member)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-900">{member.nickname}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {member.status === 'ACTIVE' ? '在线' : member.status}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      member.role === 'OWNER'
                        ? 'bg-blue-100 text-blue-700'
                        : member.userId === user?.id
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {getMemberBadge(member, user?.id)}
                  </span>
                </li>
              ))}
            </ul>

            {visibleMembers.length === 0 && (
              <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                暂无成员信息
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
