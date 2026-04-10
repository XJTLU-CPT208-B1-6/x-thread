import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileSharePanel } from '../components/FileSharePanel';
import { buildMindMapOutline, mapMindMapEdges, mapMindMapNodes } from '../lib/mindmap';
import { chatService, MindMapApiEdge, MindMapApiNode, mindMapService, roomService, sharedFileService, WhiteboardSnapshot, whiteboardService } from '../services/api-client';
import { useLanguageStore } from '../stores/useLanguageStore';
import { SharedFile, SharedFileTree } from '../types/shared-file';
import { ChatMessage } from '../types/socket-events';
import { Room } from '../types/room';

type MindMapResponse = { nodes?: MindMapApiNode[]; edges?: MindMapApiEdge[] } | null;
const roomPath = (code: string, phase: string) => phase === 'ICEBREAK' ? `/room/${code}/icebreak` : phase === 'DISCUSS' ? `/room/${code}/discuss` : phase === 'REVIEW' ? `/room/${code}/review` : `/room/${code}/lobby`;
const normalizeMessages = (messages: ChatMessage[]): ChatMessage[] =>
  messages.map((message) => ({
    ...message,
    msgType:
      message.type === 'SYSTEM'
        ? 'system'
        : message.type === 'VOICE_TRANSCRIPT'
          ? 'ai_notify'
          : 'text',
  }));
const downloadBlob = (blob: Blob, filename: string) => { const url = window.URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); window.URL.revokeObjectURL(url); };
const toRangeStart = (value: string) => value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
const toRangeEnd = (value: string) => value ? new Date(`${value}T23:59:59`).toISOString() : undefined;

export default function RoomHistoryPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { language } = useLanguageStore();
  const copy = language === 'en' ? {
    history: 'Room History', roomMissing: 'Room history', desc: 'This page remains accessible for 14 days after leaving or after the room is dissolved. Shared file downloads remain valid for 7 days.', back: 'Back to Workspace', rejoin: 'Rejoin Room', busy: 'Working...', searchTitle: 'Chat History Search', results: 'results', search: 'Search chat by keyword', query: 'Search', querying: 'Searching...', reset: 'Reset', noMessages: 'No chat history found', outline: 'Mind Map Outline', outlineDesc: 'View the room mind map structure in read-only outline mode.', noOutline: 'No mind map data available.', board: 'Whiteboard', updated: 'Latest update', none: 'N/A', noBoard: 'No whiteboard content yet.', chatFailed: 'Failed to search room history', rejoinFailed: 'Failed to rejoin room', filesTitle: 'Shared File History', filesDesc: 'In history mode, downloads only work for files still within the 7-day validity window.',
  } : {
    history: '房间历史', roomMissing: '房间历史', desc: '该页面会在离开房间或房间解散后的 14 天内保留访问。共享文件下载权限保留 7 天。', back: '返回工作台', rejoin: '重新加入房间', busy: '处理中...', searchTitle: '聊天历史查询', results: '条结果', search: '按关键词搜索聊天', query: '查询', querying: '查询中...', reset: '重置', noMessages: '暂无聊天记录', outline: '思维导图大纲', outlineDesc: '以只读大纲方式查看房间导图结构。', noOutline: '当前没有可用的思维导图记录。', board: '文字白板', updated: '最近更新', none: '暂无', noBoard: '当前没有白板内容。', chatFailed: '历史聊天查询失败', rejoinFailed: '重新加入房间失败', filesTitle: '共享文件历史', filesDesc: '历史模式下只允许下载仍在 7 天有效期内的文件。',
  };

  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  const [fileTree, setFileTree] = useState<SharedFileTree>({ folders: [], files: [] });
  const [board, setBoard] = useState<WhiteboardSnapshot | null>(null);
  const [map, setMap] = useState<MindMapResponse>(null);
  const [loading, setLoading] = useState(true);
  const [rejoinBusy, setRejoinBusy] = useState(false);

  useEffect(() => {
    if (!code) { navigate('/'); return; }
    let cancelled = false;
    const loadHistory = async () => {
      setLoading(true);
      try {
        const nextRoom = await roomService.getRoomByCode(code, { history: true });
        if (cancelled) return;
        setRoom(nextRoom);
        const [nextMessages, nextMap, nextFiles, nextBoard] = await Promise.all([
          chatService.getMessages(nextRoom.id, { history: true, take: 200 }) as Promise<ChatMessage[]>,
          mindMapService.getMap(nextRoom.id, { history: true }) as Promise<MindMapResponse>,
          sharedFileService.listFiles(nextRoom.id, { history: true }),
          whiteboardService.getBoard(nextRoom.id, { history: true }),
        ]);
        if (cancelled) return;
        setMessages(normalizeMessages(nextMessages));
        setMap(nextMap);
        setFileTree(nextFiles);
        setBoard(nextBoard);
      } catch {
        if (!cancelled) navigate('/');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadHistory();
    return () => { cancelled = true; };
  }, [code, navigate]);

  const outline = useMemo(() => {
    if (!room) return '';
    const nodes = mapMindMapNodes(map?.nodes ?? [], room.topic);
    const edges = mapMindMapEdges(map?.edges ?? []);
    return nodes.length === 0 ? '' : buildMindMapOutline(room.topic, nodes, edges);
  }, [map?.edges, map?.nodes, room]);

  const handleSearchMessages = async () => {
    if (!room?.id) return;
    setChatBusy(true); setChatError('');
    try {
      const nextMessages = await chatService.getMessages(room.id, { history: true, take: 200, query: searchQuery.trim() || undefined, from: toRangeStart(searchFrom), to: toRangeEnd(searchTo) });
      setMessages(normalizeMessages(nextMessages as ChatMessage[]));
    } catch (error: any) {
      setChatError(error?.response?.data?.message ?? copy.chatFailed);
    } finally { setChatBusy(false); }
  };

  const handleResetSearch = async () => {
    if (!room?.id) return;
    setSearchQuery(''); setSearchFrom(''); setSearchTo(''); setChatError(''); setChatBusy(true);
    try { const nextMessages = await chatService.getMessages(room.id, { history: true, take: 200 }); setMessages(normalizeMessages(nextMessages as ChatMessage[])); }
    finally { setChatBusy(false); }
  };

  const handleDownloadFile = async (file: SharedFile) => {
    if (!room?.id) throw new Error('Room history is not ready');
    const blob = await sharedFileService.downloadFile(room.id, file.id, { history: true });
    downloadBlob(blob, file.filename);
  };

  const handleBatchDownload = async (files: SharedFile[]) => { for (const file of files) { await handleDownloadFile(file); await new Promise((resolve) => setTimeout(resolve, 150)); } };
  const handleRejoin = async () => { if (!code || rejoinBusy) return; setRejoinBusy(true); try { const result = await roomService.joinRoom(code); navigate(roomPath(result.room.code, result.room.phase)); } catch (error: any) { window.alert(error?.response?.data?.message ?? copy.rejoinFailed); } finally { setRejoinBusy(false); } };

  if (loading) return <div className="min-h-screen bg-slate-950" />;

  return (
    <div className="min-h-screen bg-[linear-gradient(150deg,_#f8fafc_0%,_#e0f2fe_48%,_#eff6ff_100%)] px-4 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[32px] border border-white/60 bg-white/90 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{copy.history}</div>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">{room?.topic ?? copy.roomMissing}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{copy.desc}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => navigate('/?section=recent-rooms')} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{copy.back}</button>
              <button type="button" onClick={() => void handleRejoin()} disabled={rejoinBusy} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">{rejoinBusy ? copy.busy : copy.rejoin}</button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[28px] border border-white/60 bg-white/92 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">{copy.searchTitle}</h2><span className="text-xs text-slate-500">{messages.length} {copy.results}</span></div>
            <div className="grid gap-2">
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={copy.search} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              <div className="grid grid-cols-2 gap-2"><input type="date" value={searchFrom} onChange={(event) => setSearchFrom(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /><input type="date" value={searchTo} onChange={(event) => setSearchTo(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
              <div className="flex gap-2"><button type="button" onClick={() => void handleSearchMessages()} disabled={chatBusy} className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">{chatBusy ? copy.querying : copy.query}</button><button type="button" onClick={() => void handleResetSearch()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{copy.reset}</button></div>
            </div>
            {chatError ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{chatError}</div> : null}
            <div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">{messages.length === 0 ? <div className="text-center text-sm text-slate-500">{copy.noMessages}</div> : messages.map((message) => <div key={message.id} className="rounded-2xl bg-white p-3 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold text-slate-900">{message.nickname}</div><div className="text-[11px] text-slate-400">{new Date(message.createdAt).toLocaleString()}</div></div><div className="mt-2 text-sm leading-6 text-slate-700">{message.content}</div></div>)}</div>
          </div>

          <div className="flex flex-col gap-6">
            <section className="rounded-[28px] border border-white/60 bg-white/92 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <h2 className="text-xl font-bold text-slate-900">{copy.outline}</h2>
              <p className="mt-2 text-sm text-slate-500">{copy.outlineDesc}</p>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-sm leading-7 text-slate-100">{outline ? <pre className="whitespace-pre-wrap font-mono">{outline}</pre> : <div className="text-slate-400">{copy.noOutline}</div>}</div>
            </section>

            <section className="rounded-[28px] border border-white/60 bg-white/92 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <h2 className="text-xl font-bold text-slate-900">{copy.board}</h2>
              <p className="mt-2 text-sm text-slate-500">{copy.updated}：{board?.updatedByNickname ?? copy.none} {board?.updatedAt ? `| ${new Date(board.updatedAt).toLocaleString()}` : ''}</p>
              <div className="mt-4 min-h-[180px] rounded-2xl border border-slate-200 bg-white p-5">{board?.contentHtml ? <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: board.contentHtml }} /> : <div className="text-sm text-slate-400">{copy.noBoard}</div>}</div>
            </section>

            <div className="min-h-[420px]"><FileSharePanel fileTree={fileTree} loading={false} readOnly title={copy.filesTitle} description={copy.filesDesc} onRefresh={() => Promise.resolve()} onUpload={async () => {}} onCreateFolder={async () => {}} onRenameFolder={async () => {}} onDownload={handleDownloadFile} onBatchDownload={handleBatchDownload} /></div>
          </div>
        </section>
      </div>
    </div>
  );
}
