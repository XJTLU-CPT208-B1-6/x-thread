import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, RefreshCw, Trash2, Users, ArrowLeft, X } from 'lucide-react';
import { adminService } from '../services/api-client';
import { useUserStore } from '../stores/useUserStore';

type AdminRoom = {
  id: string;
  code: string;
  topic: string;
  phase: string;
  mode: string;
  maxMembers: number;
  isLocked: boolean;
  tags: string[];
  ownerId: string | null;
  members: Array<{ userId: string; nickname: string; role: string }>;
  createdAt: string;
};

const phaseLabel: Record<string, string> = {
  LOBBY: 'Lobby',
  ICEBREAK: 'Icebreak',
  DISCUSS: 'Discuss',
  REVIEW: 'Review',
  CLOSED: 'Closed',
};

export default function AdminPage() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [dissolving, setDissolving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);

  const fetchRooms = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminService.listRooms();
      setRooms(data as AdminRoom[]);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        setForbidden(true);
      } else {
        setError(e?.response?.data?.message ?? 'Failed to load rooms');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchRooms(); }, []);

  const handleDissolve = async (room: AdminRoom) => {
    if (!window.confirm(`Force-dissolve "${room.topic}" (${room.code})?\n\nMembers will be kicked but history is preserved.`)) return;
    setDissolving(room.id);
    try {
      await adminService.forceDissolve(room.id);
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Failed to dissolve room');
    } finally {
      setDissolving(null);
    }
  };

  const handleDelete = async (room: AdminRoom) => {
    if (!window.confirm(`⚠️ PERMANENTLY DELETE "${room.topic}" (${room.code})?\n\nThis removes ALL data — messages, mind maps, files, members — and cannot be undone.`)) return;
    setDeleting(room.id);
    try {
      await adminService.forceDelete(room.id);
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Failed to delete room');
    } finally {
      setDeleting(null);
    }
  };

  if (forbidden) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-100">
        <div className="text-center space-y-4">
          <div className="text-5xl">🚫</div>
          <p className="text-lg font-bold">Access Denied</p>
          <p className="text-sm text-slate-400">This page requires admin privileges.</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="h-4 w-px bg-slate-700" />
            <Shield className="h-5 w-5 text-violet-400" />
            <span className="font-bold text-slate-100">Admin Panel</span>
            <span className="rounded-full bg-violet-900/60 px-2 py-0.5 text-xs font-semibold text-violet-300">
              {user.name}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void fetchRooms()}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Rooms', value: rooms.length },
            { label: 'Active Members', value: rooms.reduce((s, r) => s + r.members.length, 0) },
            { label: 'Closed Rooms', value: rooms.filter((r) => r.phase === 'CLOSED').length },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="text-2xl font-black text-slate-100">{stat.value}</div>
              <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-rose-800 bg-rose-950 px-4 py-3 text-sm text-rose-300">{error}</div>
        )}

        {/* Room table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-800 px-5 py-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            All Active Rooms
          </div>
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">Loading...</div>
          ) : rooms.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">No active rooms.</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {rooms.map((room) => (
                <div key={room.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-slate-500">{room.code}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        room.isLocked ? 'bg-slate-700 text-slate-400' : 'bg-emerald-900/60 text-emerald-400'
                      }`}>
                        {room.isLocked ? '🔒 Locked' : '🟢 Open'}
                      </span>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                        {phaseLabel[room.phase] ?? room.phase}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-200 truncate">{room.topic}</div>
                    {room.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {room.tags.slice(0, 3).map((t) => (
                          <span key={t} className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-slate-400 shrink-0">
                    <Users className="h-3.5 w-3.5" />
                    {room.members.length}/{room.maxMembers}
                  </div>
                  <div className="shrink-0 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDissolve(room)}
                      disabled={dissolving === room.id || deleting === room.id}
                      className="flex items-center gap-1.5 rounded-lg border border-amber-700 px-3 py-1.5 text-xs font-semibold text-amber-400 transition hover:bg-amber-950 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {dissolving === room.id ? 'Dissolving...' : 'Dissolve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(room)}
                      disabled={dissolving === room.id || deleting === room.id}
                      className="flex items-center gap-1.5 rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-950 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      {deleting === room.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
