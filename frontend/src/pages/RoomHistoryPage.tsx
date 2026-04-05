import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileSharePanel } from '../components/FileSharePanel';
import { buildMindMapOutline, mapMindMapEdges, mapMindMapNodes } from '../lib/mindmap';
import {
  chatService,
  MindMapApiEdge,
  MindMapApiNode,
  mindMapService,
  roomService,
  sharedFileService,
  WhiteboardSnapshot,
  whiteboardService,
} from '../services/api-client';
import { SharedFile, SharedFileTree } from '../types/shared-file';
import { ChatMessage } from '../types/socket-events';
import { Room } from '../types/room';

type MindMapResponse = {
  nodes?: MindMapApiNode[];
  edges?: MindMapApiEdge[];
} | null;

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

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const toRangeStart = (value: string) =>
  value ? new Date(`${value}T00:00:00`).toISOString() : undefined;

const toRangeEnd = (value: string) =>
  value ? new Date(`${value}T23:59:59`).toISOString() : undefined;

export default function RoomHistoryPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
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
    if (!code) {
      navigate('/');
      return;
    }

    let cancelled = false;

    const loadHistory = async () => {
      setLoading(true);
      try {
        const nextRoom = await roomService.getRoomByCode(code, { history: true });
        if (cancelled) {
          return;
        }

        setRoom(nextRoom);

        const [nextMessages, nextMap, nextFiles, nextBoard] = await Promise.all([
          chatService.getMessages(nextRoom.id, { history: true, take: 200 }) as Promise<ChatMessage[]>,
          mindMapService.getMap(nextRoom.id, { history: true }) as Promise<MindMapResponse>,
          sharedFileService.listFiles(nextRoom.id, { history: true }),
          whiteboardService.getBoard(nextRoom.id, { history: true }),
        ]);

        if (cancelled) {
          return;
        }

        setMessages(normalizeMessages(nextMessages));
        setMap(nextMap);
        setFileTree(nextFiles);
        setBoard(nextBoard);
      } catch (error) {
        console.error('Failed to load room history:', error);
        if (!cancelled) {
          navigate('/');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  const outline = useMemo(() => {
    if (!room) {
      return '';
    }

    const nodes = mapMindMapNodes(map?.nodes ?? [], room.topic);
    const edges = mapMindMapEdges(map?.edges ?? []);
    if (nodes.length === 0) {
      return '';
    }

    return buildMindMapOutline(room.topic, nodes, edges);
  }, [map?.edges, map?.nodes, room]);

  const handleSearchMessages = async () => {
    if (!room?.id) {
      return;
    }

    setChatBusy(true);
    setChatError('');
    try {
      const nextMessages = await chatService.getMessages(room.id, {
        history: true,
        take: 200,
        query: searchQuery.trim() || undefined,
        from: toRangeStart(searchFrom),
        to: toRangeEnd(searchTo),
      });
      setMessages(normalizeMessages(nextMessages as ChatMessage[]));
    } catch (error: any) {
      setChatError(error?.response?.data?.message ?? '历史聊天查询失败');
    } finally {
      setChatBusy(false);
    }
  };

  const handleResetSearch = async () => {
    if (!room?.id) {
      return;
    }

    setSearchQuery('');
    setSearchFrom('');
    setSearchTo('');
    setChatError('');
    setChatBusy(true);
    try {
      const nextMessages = await chatService.getMessages(room.id, {
        history: true,
        take: 200,
      });
      setMessages(normalizeMessages(nextMessages as ChatMessage[]));
    } finally {
      setChatBusy(false);
    }
  };

  const handleDownloadFile = async (file: SharedFile) => {
    if (!room?.id) {
      throw new Error('Room history is not ready');
    }

    const blob = await sharedFileService.downloadFile(room.id, file.id, {
      history: true,
    });
    downloadBlob(blob, file.filename);
  };

  const handleBatchDownload = async (files: SharedFile[]) => {
    for (const file of files) {
      await handleDownloadFile(file);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  };

  const handleRejoin = async () => {
    if (!code || rejoinBusy) {
      return;
    }

    setRejoinBusy(true);
    try {
      const result = await roomService.joinRoom(code);
      navigate(resolveRoomPathFromPhase(result.room.code, result.room.phase));
    } catch (error: any) {
      window.alert(error?.response?.data?.message ?? '重新加入房间失败');
    } finally {
      setRejoinBusy(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(150deg,_#f8fafc_0%,_#e0f2fe_48%,_#eff6ff_100%)] px-4 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[32px] border border-white/60 bg-white/90 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                Room History
              </div>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">
                {room?.topic ?? '房间历史'}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                该页面仅在离开或房间解散后的 14 天内可访问。共享文件下载权限保留 7 天，过期后仍显示记录但不能再下载。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                返回首页
              </button>
              <button
                type="button"
                onClick={() => void handleRejoin()}
                disabled={rejoinBusy}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rejoinBusy ? '处理中...' : '重新加入'}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[28px] border border-white/60 bg-white/92 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">聊天历史查询</h2>
              <span className="text-xs text-slate-500">{messages.length} 条结果</span>
            </div>

            <div className="grid gap-2">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="按关键词搜索聊天"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={searchFrom}
                  onChange={(event) => setSearchFrom(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <input
                  type="date"
                  value={searchTo}
                  onChange={(event) => setSearchTo(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleSearchMessages()}
                  disabled={chatBusy}
                  className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {chatBusy ? '查询中...' : '查询'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleResetSearch()}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  重置
                </button>
              </div>
            </div>

            {chatError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {chatError}
              </div>
            )}

            <div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {messages.length === 0 ? (
                <div className="text-center text-sm text-slate-500">暂无聊天记录</div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="rounded-2xl bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">{message.nickname}</div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(message.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-700">{message.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <section className="rounded-[28px] border border-white/60 bg-white/92 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <h2 className="text-xl font-bold text-slate-900">思维导图大纲</h2>
              <p className="mt-2 text-sm text-slate-500">
                历史模式下以只读大纲方式查看房间导图结构。
              </p>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-sm leading-7 text-slate-100">
                {outline ? (
                  <pre className="whitespace-pre-wrap font-mono">{outline}</pre>
                ) : (
                  <div className="text-slate-400">当前没有可用的思维导图记录。</div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/60 bg-white/92 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <h2 className="text-xl font-bold text-slate-900">文字白板</h2>
              <p className="mt-2 text-sm text-slate-500">
                最近更新：{board?.updatedByNickname ?? '暂无'} {board?.updatedAt ? `| ${new Date(board.updatedAt).toLocaleString()}` : ''}
              </p>

              <div className="mt-4 min-h-[180px] rounded-2xl border border-slate-200 bg-white p-5">
                {board?.contentHtml ? (
                  <div
                    className="prose prose-slate max-w-none"
                    dangerouslySetInnerHTML={{ __html: board.contentHtml }}
                  />
                ) : (
                  <div className="text-sm text-slate-400">当前没有白板内容。</div>
                )}
              </div>
            </section>

            <div className="min-h-[420px]">
              <FileSharePanel
                fileTree={fileTree}
                loading={false}
                readOnly
                title="共享文件历史"
                description="历史模式下只允许查询和下载仍在 7 天有效期内的文件。"
                onRefresh={() => Promise.resolve()}
                onUpload={async () => {}}
                onCreateFolder={async () => {}}
                onRenameFolder={async () => {}}
                onDownload={handleDownloadFile}
                onBatchDownload={handleBatchDownload}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
