import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomService } from '../services/api-client';
import { socketService } from '../services/socket-service';
import { useRoomStore } from '../stores/useRoomStore';
import { useUserStore } from '../stores/useUserStore';
import { resolveRoomPathFromPhase } from '../utils/roomUtils';

// ── Vibe tags ──────────────────────────────────────────────────────────────
const VIBE_TAGS = ['认真学习 📚', '佛系摸鱼 🐟', '赶DDL 🔥', '头脑风暴 💡', '互相监督 👀', '随便聊聊 💬'];
const COURSE_TAGS = ['高数', '英语', '编程', '物理', '经济', '设计', '其他'];

const VIBE_COLORS: Record<string, string> = {
  '认真学习 📚': 'bg-blue-100 text-blue-700',
  '佛系摸鱼 🐟': 'bg-green-100 text-green-700',
  '赶DDL 🔥': 'bg-red-100 text-red-700',
  '头脑风暴 💡': 'bg-yellow-100 text-yellow-700',
  '互相监督 👀': 'bg-purple-100 text-purple-700',
  '随便聊聊 💬': 'bg-pink-100 text-pink-700',
};

type LobbyRoom = {
  id: string;
  code: string;
  topic: string;
  phase: string;
  mode: string;
  maxMembers: number;
  isLocked: boolean;
  tags: string[];
  ownerId: string;
  members: Array<{ userId: string; nickname: string; avatar?: string | null; role: string }>;
  createdAt: string;
};

export default function GroupLobbyPage() {
  const navigate = useNavigate();
  const { setRoom } = useRoomStore();
  const { user } = useUserStore();

  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [locking, setLocking] = useState<string | null>(null);

  // filters
  const [filterVibe, setFilterVibe] = useState<string | null>(null);
  const [filterCourse, setFilterCourse] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    topic: '',
    maxMembers: 6,
    selectedTags: [] as string[],
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRooms = async () => {
    try {
      const data = await roomService.listLobby();
      setRooms(data as LobbyRoom[]);
    } catch {
      // silently ignore poll errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Connect socket so we receive global lobby events
    socketService.connect();

    void fetchRooms();
    // poll every 5s for live updates
    pollRef.current = setInterval(() => void fetchRooms(), 5000);

    // Instantly remove dissolved rooms without waiting for next poll
    const handleRemoved = (e: Event) => {
      const { roomId } = (e as CustomEvent<{ roomId: string }>).detail;
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
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
      alert(e?.response?.data?.message ?? '加入失败，请重试');
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
      alert(e?.response?.data?.message ?? '操作失败');
    } finally {
      setLocking(null);
    }
  };

  const handleCreate = async () => {
    if (!createForm.topic.trim()) { setCreateError('请输入讨论主题'); return; }
    setCreating(true);
    setCreateError('');
    try {
      const result = await roomService.createRoom({
        topic: createForm.topic.trim(),
        maxMembers: createForm.maxMembers,
        tags: createForm.selectedTags,
      });
      setRoom(result.room);
      navigate(resolveRoomPathFromPhase(result.room.code, result.room.phase));
    } catch (e: any) {
      setCreateError(e?.response?.data?.message ?? '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const toggleTag = (tag: string) => {
    setCreateForm((f) => ({
      ...f,
      selectedTags: f.selectedTags.includes(tag)
        ? f.selectedTags.filter((t) => t !== tag)
        : [...f.selectedTags, tag],
    }));
  };

  // ── Filter logic ──────────────────────────────────────────────────────────
  const filtered = rooms.filter((r) => {
    if (filterVibe && !r.tags.includes(filterVibe)) return false;
    if (filterCourse && !r.tags.includes(filterCourse) && !r.topic.includes(filterCourse)) return false;
    if (search && !r.topic.toLowerCase().includes(search.toLowerCase()) && !r.code.includes(search.toUpperCase())) return false;
    return true;
  });

  const myRooms = rooms.filter((r) => r.members.some((m) => m.userId === user?.id));

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-pink-50">
      {/* ── Top Nav ── */}
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-slate-400 hover:text-slate-600 transition text-sm"
            >
              ← 返回
            </button>
            <span className="text-xl font-black text-violet-700">🎮 组队大厅</span>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-600">
              {rooms.length} 个房间开着呢
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-95"
            >
              ✨ 开个房间
            </button>
            <button
              type="button"
              onClick={() => void fetchRooms()}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              🔄 刷新
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        {/* ── Hero ── */}
        <div className="rounded-2xl bg-gradient-to-r from-violet-500 to-blue-500 p-6 text-white shadow-lg">
          <p className="text-2xl font-black mb-1">组队大厅</p>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 搜索主题或房间号..."
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 w-52"
          />
          <div className="flex flex-wrap gap-2">
            {VIBE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setFilterVibe(filterVibe === tag ? null : tag)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition border ${
                  filterVibe === tag
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {COURSE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setFilterCourse(filterCourse === tag ? null : tag)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition border ${
                  filterCourse === tag
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          {(filterVibe || filterCourse || search) && (
            <button
              type="button"
              onClick={() => { setFilterVibe(null); setFilterCourse(null); setSearch(''); }}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              清除筛选
            </button>
          )}
        </div>

        {/* ── My Rooms ── */}
        {myRooms.length > 0 && (
          <div>
            <p className="text-sm font-bold text-slate-500 mb-2">📌 我在里面的房间</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  userId={user?.id}
                  joining={joining === room.id}
                  locking={locking === room.id}
                  onJoin={() => void handleJoin(room)}
                  onToggleLock={() => void handleToggleLock(room)}
                  highlight
                />
              ))}
            </div>
          </div>
        )}

        {/* ── All Rooms ── */}
        <div>
          <p className="text-sm font-bold text-slate-500 mb-3">
            🏠 所有开放房间 {filtered.length > 0 && <span className="text-slate-400 font-normal">({filtered.length})</span>}
          </p>
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-44 rounded-2xl bg-white/60 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
              <p className="text-4xl mb-3">🌵</p>
              <p className="text-slate-500 font-semibold">暂时没有符合条件的房间</p>
              <p className="text-slate-400 text-sm mt-1">要不要自己开一个？</p>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-4 rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white hover:bg-violet-700"
              >
                ✨ 开个房间
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  userId={user?.id}
                  joining={joining === room.id}
                  locking={locking === room.id}
                  onJoin={() => void handleJoin(room)}
                  onToggleLock={() => void handleToggleLock(room)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Create Modal ── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-slate-800">✨ 开个新房间</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">讨论主题 *</label>
                <input
                  value={createForm.topic}
                  onChange={(e) => setCreateForm((f) => ({ ...f, topic: e.target.value }))}
                  placeholder="例如：高数期末复习、毕设头脑风暴..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">人数上限</label>
                <div className="flex gap-2">
                  {[2, 4, 6, 8, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCreateForm((f) => ({ ...f, maxMembers: n }))}
                      className={`flex-1 rounded-xl py-2 text-sm font-bold transition border ${
                        createForm.maxMembers === n
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">氛围标签（可多选）</label>
                <div className="flex flex-wrap gap-2">
                  {[...VIBE_TAGS, ...COURSE_TAGS].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition border ${
                        createForm.selectedTags.includes(tag)
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {createError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{createError}</div>
              )}

              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating}
                className="w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                {creating ? '创建中...' : '🚀 立即开房，入座即聊！'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Room Card Component ────────────────────────────────────────────────────
function RoomCard({
  room,
  userId,
  joining,
  locking,
  onJoin,
  onToggleLock,
  highlight = false,
}: {
  room: LobbyRoom;
  userId?: string;
  joining: boolean;
  locking: boolean;
  onJoin: () => void;
  onToggleLock: () => void;
  highlight?: boolean;
}) {
  const isOwner = room.members.some((m) => m.userId === userId && m.role === 'OWNER');
  const isMember = room.members.some((m) => m.userId === userId);
  const isFull = room.members.length >= room.maxMembers;

  const phaseLabel: Record<string, string> = {
    LOBBY: '大厅等待中',
    ICEBREAK: '破冰进行中',
    DISCUSS: '讨论进行中',
    REVIEW: '复盘中',
  };

  return (
    <div className={`relative flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
      highlight ? 'border-violet-300 ring-2 ring-violet-100' : 'border-slate-100'
    }`}>
      {/* Status badge */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-bold ${room.isLocked ? 'text-slate-400' : 'text-emerald-600'}`}>
          {room.isLocked ? '🔒 已锁定' : '🟢 开放中'}
        </span>
        <span className="text-xs text-slate-400">{phaseLabel[room.phase] ?? room.phase}</span>
      </div>

      {/* Topic */}
      <p className="font-bold text-slate-800 text-sm leading-snug mb-2 line-clamp-2">{room.topic}</p>

      {/* Tags */}
      {room.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {room.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${VIBE_COLORS[tag] ?? 'bg-slate-100 text-slate-600'}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Members */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex -space-x-1.5">
          {room.members.slice(0, 5).map((m) => (
            <div
              key={m.userId}
              title={m.nickname}
              className="h-6 w-6 rounded-full border-2 border-white bg-gradient-to-br from-violet-400 to-blue-400 flex items-center justify-center text-[9px] font-bold text-white overflow-hidden"
            >
              {m.avatar ? <img src={m.avatar} alt={m.nickname} className="h-full w-full object-cover" /> : m.nickname[0]}
            </div>
          ))}
        </div>
        <span className="text-xs text-slate-500">
          {room.members.length}/{room.maxMembers} 人
          {isFull && !isMember && <span className="ml-1 text-rose-400 font-semibold">· 已满</span>}
        </span>
        <span className="ml-auto text-[10px] font-mono text-slate-300">{room.code}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        {isMember ? (
          <button
            type="button"
            onClick={onJoin}
            disabled={joining}
            className="flex-1 rounded-xl bg-violet-600 py-2 text-xs font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            {joining ? '进入中...' : '🚪 回到房间'}
          </button>
        ) : room.isLocked ? (
          <div className="flex-1 rounded-xl bg-slate-100 py-2 text-center text-xs font-semibold text-slate-400">
            🔒 房间已锁
          </div>
        ) : isFull ? (
          <div className="flex-1 rounded-xl bg-slate-100 py-2 text-center text-xs font-semibold text-slate-400">
            😅 人满了
          </div>
        ) : (
          <button
            type="button"
            onClick={onJoin}
            disabled={joining}
            className="flex-1 rounded-xl bg-violet-600 py-2 text-xs font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            {joining ? '加入中...' : '👋 加入'}
          </button>
        )}

        {isOwner && (
          <button
            type="button"
            onClick={onToggleLock}
            disabled={locking}
            title={room.isLocked ? '解锁房间' : '锁定房间'}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {locking ? '...' : room.isLocked ? '🔓' : '🔒'}
          </button>
        )}
      </div>
    </div>
  );
}
