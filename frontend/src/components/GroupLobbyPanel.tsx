import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguageStore } from '../stores/useLanguageStore';
import { roomService } from '../services/api-client';
import { socketService } from '../services/socket-service';
import { useRoomStore } from '../stores/useRoomStore';
import { useUserStore } from '../stores/useUserStore';
import { resolveRoomPathFromPhase } from '../utils/roomUtils';

type LobbyRoom = {
  id: string;
  code: string;
  topic: string;
  phase: string;
  mode: string;
  maxMembers: number;
  isPublic: boolean;
  isLocked: boolean;
  tags: string[];
  ownerId: string;
  members: Array<{ userId: string; nickname: string; avatar?: string | null; role: string }>;
  createdAt: string;
};

const VIBE_TAGS = ['Study', 'Casual', 'Deadline', 'Brainstorm', 'Support', 'Project'];
const TAG_COLORS: Record<string, string> = {
  Study: 'bg-blue-100 text-blue-700',
  Casual: 'bg-green-100 text-green-700',
  Deadline: 'bg-red-100 text-red-700',
  Brainstorm: 'bg-yellow-100 text-yellow-700',
  Support: 'bg-purple-100 text-purple-700',
  Project: 'bg-pink-100 text-pink-700',
};

function RoomCard({ room, userId, joining, locking, onJoin, onToggleLock, highlight, copy }: { room: LobbyRoom; userId?: string; joining: boolean; locking: boolean; onJoin: () => void; onToggleLock: () => void; highlight?: boolean; copy: any }) {
  const isOwner = room.members.some((m) => m.userId === userId && m.role === 'OWNER');
  const isMember = room.members.some((m) => m.userId === userId);
  const isFull = room.members.length >= room.maxMembers;
  const phaseLabel: Record<string, string> = { LOBBY: copy.phaseLobby, ICEBREAK: copy.phaseIcebreak, DISCUSS: copy.phaseDiscuss, REVIEW: copy.phaseReview };

  return (
    <div className={`relative flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${highlight ? 'border-violet-300 ring-2 ring-violet-100' : 'border-slate-100'}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className={`text-xs font-bold ${room.isLocked ? 'text-slate-400' : 'text-emerald-600'}`}>{room.isLocked ? copy.locked : copy.open}</span>
        <span className="text-xs text-slate-400">{phaseLabel[room.phase] ?? room.phase}</span>
      </div>
      <p className="mb-2 line-clamp-2 text-sm font-bold leading-snug text-slate-800">{room.topic}</p>
      {room.tags.length > 0 ? <div className="mb-3 flex flex-wrap gap-1">{room.tags.slice(0, 3).map((tag) => <span key={tag} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TAG_COLORS[tag] ?? 'bg-slate-100 text-slate-600'}`}>{tag}</span>)}</div> : null}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex -space-x-1.5">{room.members.slice(0, 5).map((m) => <div key={m.userId} title={m.nickname} className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-violet-400 to-blue-400 text-[9px] font-bold text-white">{m.avatar ? <img src={m.avatar} alt={m.nickname} className="h-full w-full object-cover" /> : m.nickname[0]}</div>)}</div>
        <span className="text-xs text-slate-500">{room.members.length}/{room.maxMembers} {copy.members}{isFull && !isMember ? <span className="ml-1 font-semibold text-rose-400">{copy.full}</span> : null}</span>
        <span className="ml-auto font-mono text-[10px] text-slate-300">{room.code}</span>
      </div>
      <div className="mt-auto flex gap-2">
        {isMember ? (
          <button type="button" onClick={onJoin} disabled={joining} className="flex-1 rounded-xl bg-violet-600 py-2 text-xs font-bold text-white transition hover:bg-violet-700 disabled:opacity-50">{joining ? copy.entering : copy.backToRoom}</button>
        ) : room.isLocked ? (
          <div className="flex-1 rounded-xl bg-slate-100 py-2 text-center text-xs font-semibold text-slate-400">{copy.roomLocked}</div>
        ) : isFull ? (
          <div className="flex-1 rounded-xl bg-slate-100 py-2 text-center text-xs font-semibold text-slate-400">{copy.roomFull}</div>
        ) : (
          <button type="button" onClick={onJoin} disabled={joining} className="flex-1 rounded-xl bg-violet-600 py-2 text-xs font-bold text-white transition hover:bg-violet-700 disabled:opacity-50">{joining ? copy.joining : copy.join}</button>
        )}
        {isOwner ? <button type="button" onClick={onToggleLock} disabled={locking} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 disabled:opacity-50">{locking ? '...' : room.isLocked ? '🔓' : '🔒'}</button> : null}
      </div>
    </div>
  );
}

export function GroupLobbyPanel() {
  const navigate = useNavigate();
  const { language } = useLanguageStore();
  const { setRoom } = useRoomStore();
  const { user } = useUserStore();
  const copy = useMemo(() => language === 'en' ? {
    title: 'Group Lobby', subtitle: 'Create a room, discover public rooms, and jump in immediately.', createRoom: 'Create Room', refresh: 'Refresh', search: 'Search by topic or room code', clear: 'Clear', myRooms: 'Rooms I Joined', allRooms: 'All Public Rooms', empty: 'No rooms match your current filters', createFirst: 'Create the first room', join: 'Join', joining: 'Joining...', entering: 'Entering...', backToRoom: 'Back to Room', roomLocked: 'Room Locked', roomFull: 'Room Full', locked: 'Locked', open: 'Open', members: 'members', full: 'Full', phaseLobby: 'In Lobby', phaseIcebreak: 'Icebreak', phaseDiscuss: 'Discussing', phaseReview: 'Review', createTitle: 'Create a New Room', topic: 'Discussion Topic', topicRequired: 'Please enter a topic', maxMembers: 'Max Members', tags: 'Tags', publicLabel: 'Public in Group Lobby', publicDesc: 'If enabled, others can discover this room in the public lobby before it is dissolved.', submit: 'Create and Enter', submitting: 'Creating...', createFailed: 'Failed to create room', joinFailed: 'Failed to join room', lockFailed: 'Failed to update room lock',
  } : {
    title: '组队大厅', subtitle: '创建房间、发现公开房间、随时加入讨论。', createRoom: '创建房间', refresh: '刷新', search: '按主题或房间码搜索', clear: '清除', myRooms: '我已加入的房间', allRooms: '所有公开房间', empty: '当前筛选条件下没有房间', createFirst: '创建第一个房间', join: '加入', joining: '加入中...', entering: '进入中...', backToRoom: '回到房间', roomLocked: '房间已锁定', roomFull: '房间已满', locked: '已锁定', open: '开放中', members: '人', full: '已满', phaseLobby: '大厅等待中', phaseIcebreak: '破冰中', phaseDiscuss: '讨论中', phaseReview: '复盘中', createTitle: '创建新房间', topic: '讨论主题', topicRequired: '请输入讨论主题', maxMembers: '人数上限', tags: '标签', publicLabel: '公开到组队大厅', publicDesc: '开启后其他人可以在大厅里直接发现并加入该房间。', submit: '创建并进入', submitting: '创建中...', createFailed: '创建房间失败', joinFailed: '加入房间失败', lockFailed: '更新锁定状态失败',
  }, [language]);

  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [locking, setLocking] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ topic: '', maxMembers: 6, isPublic: true, selectedTags: [] as string[] });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRooms = async () => {
    try {
      setRooms((await roomService.listLobby()) as LobbyRoom[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    socketService.connect();
    void fetchRooms();
    pollRef.current = setInterval(() => void fetchRooms(), 5000);
    const handleRemoved = (event: Event) => {
      const { roomId } = (event as CustomEvent<{ roomId: string }>).detail;
      setRooms((prev) => prev.filter((room) => room.id !== roomId));
    };
    window.addEventListener('x-thread-lobby-room-removed', handleRemoved);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      window.removeEventListener('x-thread-lobby-room-removed', handleRemoved);
    };
  }, []);

  const handleJoin = async (room: LobbyRoom) => {
    if (joining) return;
    setJoining(room.id);
    try {
      const result = await roomService.joinRoom(room.code);
      setRoom(result.room);
      navigate(resolveRoomPathFromPhase(result.room.code, result.room.phase));
    } catch (e: any) {
      alert(e?.response?.data?.message ?? copy.joinFailed);
    } finally {
      setJoining(null);
    }
  };

  const handleToggleLock = async (room: LobbyRoom) => {
    if (locking) return;
    setLocking(room.id);
    try {
      await roomService.toggleLock(room.id);
      await fetchRooms();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? copy.lockFailed);
    } finally {
      setLocking(null);
    }
  };

  const handleCreate = async () => {
    if (!createForm.topic.trim()) {
      setCreateError(copy.topicRequired);
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const result = await roomService.createRoom({ topic: createForm.topic.trim(), maxMembers: createForm.maxMembers, isPublic: createForm.isPublic, tags: createForm.selectedTags });
      setRoom(result.room);
      navigate(resolveRoomPathFromPhase(result.room.code, result.room.phase));
    } catch (e: any) {
      setCreateError(e?.response?.data?.message ?? copy.createFailed);
    } finally {
      setCreating(false);
    }
  };

  const toggleTag = (tag: string) => setCreateForm((current) => ({ ...current, selectedTags: current.selectedTags.includes(tag) ? current.selectedTags.filter((item) => item !== tag) : [...current.selectedTags, tag] }));

  const filteredRooms = rooms.filter((room) => {
    if (filterTag && !room.tags.includes(filterTag)) return false;
    if (search && !room.topic.toLowerCase().includes(search.toLowerCase()) && !room.code.includes(search.toUpperCase())) return false;
    return true;
  });
  const myRooms = rooms.filter((room) => room.members.some((member) => member.userId === user?.id));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-violet-500 to-blue-500 p-5 text-white shadow-sm">
        <div>
          <p className="text-lg font-black">{copy.title}</p>
          <p className="text-xs text-white/75">{copy.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowCreate(true)} className="rounded-xl bg-white/20 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/30">{copy.createRoom}</button>
          <button type="button" onClick={() => void fetchRooms()} className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/20">{copy.refresh}</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.search} className="w-52 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
        {VIBE_TAGS.map((tag) => <button key={tag} type="button" onClick={() => setFilterTag(filterTag === tag ? null : tag)} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition border ${filterTag === tag ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>{tag}</button>)}
        {(filterTag || search) ? <button type="button" onClick={() => { setFilterTag(null); setSearch(''); }} className="text-xs text-slate-400 underline hover:text-slate-600">{copy.clear}</button> : null}
      </div>

      {myRooms.length > 0 ? <div><p className="mb-2 text-xs font-bold text-slate-500">{copy.myRooms}</p><div className="grid gap-3 sm:grid-cols-2">{myRooms.map((room) => <RoomCard key={room.id} room={room} userId={user?.id} joining={joining === room.id} locking={locking === room.id} onJoin={() => void handleJoin(room)} onToggleLock={() => void handleToggleLock(room)} highlight copy={copy} />)}</div></div> : null}

      <div>
        <p className="mb-2 text-xs font-bold text-slate-500">{copy.allRooms}{filteredRooms.length > 0 ? <span className="ml-1 font-normal text-slate-400">({filteredRooms.length})</span> : null}</p>
        {loading ? <div className="grid gap-3 sm:grid-cols-2">{[1,2,3,4].map((i) => <div key={i} className="h-40 rounded-2xl bg-slate-100 animate-pulse" />)}</div> : filteredRooms.length === 0 ? <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center"><p className="text-slate-500 text-sm font-semibold">{copy.empty}</p><button type="button" onClick={() => setShowCreate(true)} className="mt-3 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700">{copy.createFirst}</button></div> : <div className="grid gap-3 sm:grid-cols-2">{filteredRooms.map((room) => <RoomCard key={room.id} room={room} userId={user?.id} joining={joining === room.id} locking={locking === room.id} onJoin={() => void handleJoin(room)} onToggleLock={() => void handleToggleLock(room)} copy={copy} />)}</div>}
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black text-slate-800">{copy.createTitle}</h2><button type="button" onClick={() => setShowCreate(false)} className="text-xl leading-none text-slate-400 hover:text-slate-600">×</button></div>
            <div className="space-y-4">
              <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.topic}</label><input value={createForm.topic} onChange={(event) => setCreateForm((current) => ({ ...current, topic: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></div>
              <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.maxMembers}</label><div className="flex gap-2">{[2,4,6,8,10].map((value) => <button key={value} type="button" onClick={() => setCreateForm((current) => ({ ...current, maxMembers: value }))} className={`flex-1 rounded-xl py-2 text-sm font-bold transition border ${createForm.maxMembers === value ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>{value}</button>)}</div></div>
              <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.tags}</label><div className="flex flex-wrap gap-2">{VIBE_TAGS.map((tag) => <button key={tag} type="button" onClick={() => toggleTag(tag)} className={`rounded-full px-3 py-1 text-xs font-semibold transition border ${createForm.selectedTags.includes(tag) ? 'bg-violet-600 text-white border-violet-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300'}`}>{tag}</button>)}</div></div>
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={createForm.isPublic} onChange={(event) => setCreateForm((current) => ({ ...current, isPublic: event.target.checked }))} className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600" /><span><span className="block font-semibold text-slate-900">{copy.publicLabel}</span><span className="block text-xs text-slate-500">{copy.publicDesc}</span></span></label>
              {createError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{createError}</div> : null}
              <button type="button" onClick={() => void handleCreate()} disabled={creating} className="w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50">{creating ? copy.submitting : copy.submit}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
