import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AiQaPanel } from '../components/AiQaPanel';
import { FileSharePanel } from '../components/FileSharePanel';
import { MindMap } from '../components/MindMap';
import { PetWidget } from '../components/PetWidget';
import { TextWhiteboard } from '../components/TextWhiteboard';
import { VoicePanel } from '../components/VoicePanel';
import { useSocket } from '../hooks/useSocket';
import { mapMindMapEdges, mapMindMapNodes } from '../lib/mindmap';
import {
  AiConversationMessage,
  AiProviderSettings,
  AiSelectedFile,
  chatService,
  MindMapApiEdge,
  MindMapApiNode,
  mindMapService,
  roomAiService,
  roomService,
  sharedFileService,
  whiteboardService,
} from '../services/api-client';
import { socketService } from '../services/socket-service';
import { useChatStore } from '../stores/useChatStore';
import { useMindMapStore } from '../stores/useMindMapStore';
import { useRoomStore } from '../stores/useRoomStore';
import { useUserStore } from '../stores/useUserStore';
import { useWhiteboardStore } from '../stores/useWhiteboardStore';
import { SharedFile, SharedFileTree } from '../types/shared-file';
import { ChatMessage } from '../types/socket-events';

type FeatureTab = 'mindmap' | 'ai' | 'files' | 'whiteboard';

type MindMapResponse = {
  nodes?: MindMapApiNode[];
  edges?: MindMapApiEdge[];
} | null;

const tabs: Array<{ id: FeatureTab; label: string }> = [
  { id: 'mindmap', label: '思维导图' },
  { id: 'ai', label: 'AI 对话' },
  { id: 'whiteboard', label: '文字白板' },
  { id: 'files', label: '文件共享' },
];

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

const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
    reader.readAsDataURL(file);
  });

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

export default function DiscussPageV2() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { currentRoom, setRoom, clearRoom } = useRoomStore();
  const { user } = useUserStore();
  const { messages, setMessages, clear: clearMessages } = useChatStore();
  const { setNodes, setEdges, clear: clearMindMap } = useMindMapStore();
  const { board, setBoard, clear: clearWhiteboard } = useWhiteboardStore();
  const [activeTab, setActiveTab] = useState<FeatureTab>('mindmap');
  const [fileTree, setFileTree] = useState<SharedFileTree>({ folders: [], files: [] });
  const [filesLoading, setFilesLoading] = useState(false);
  const [chatQuery, setChatQuery] = useState('');
  const [chatFrom, setChatFrom] = useState('');
  const [chatTo, setChatTo] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatSearchActive, setChatSearchActive] = useState(false);
  const [chatSearchResults, setChatSearchResults] = useState<ChatMessage[]>([]);
  const [roomActionBusy, setRoomActionBusy] = useState(false);

  useSocket(currentRoom?.id);

  const currentMember = useMemo(
    () => currentRoom?.members?.find((member) => member.userId === user?.id),
    [currentRoom?.members, user?.id],
  );
  const isOwner = currentMember?.role === 'OWNER';

  const displayedMessages = chatSearchActive ? chatSearchResults : messages;

  const loadSharedFiles = async (roomId: string) => {
    setFilesLoading(true);
    try {
      const nextTree = await sharedFileService.listFiles(roomId);
      setFileTree(nextTree);
    } finally {
      setFilesLoading(false);
    }
  };

  const loadLatestMessages = async (roomId: string) => {
    const nextMessages = await chatService.getMessages(roomId, { take: 200 });
    const normalized = normalizeMessages(nextMessages as ChatMessage[]);
    setMessages(normalized);
    setChatSearchActive(false);
    setChatSearchResults([]);
  };

  useEffect(() => {
    if (!code) {
      navigate('/');
      return;
    }

    let cancelled = false;

    const loadDiscussionRoom = async () => {
      try {
        clearMessages();
        clearMindMap();
        clearWhiteboard();
        setFileTree({ folders: [], files: [] });
        setChatError('');
        setChatSearchActive(false);
        setChatSearchResults([]);

        const room = await roomService.getRoomByCode(code);
        if (cancelled) {
          return;
        }

        setRoom(room);

        const [history, map, nextTree, nextBoard] = await Promise.all([
          chatService.getMessages(room.id, { take: 200 }) as Promise<ChatMessage[]>,
          mindMapService.getMap(room.id) as Promise<MindMapResponse>,
          sharedFileService.listFiles(room.id),
          whiteboardService.getBoard(room.id),
        ]);

        if (cancelled) {
          return;
        }

        setMessages(normalizeMessages(history));
        setNodes(mapMindMapNodes(map?.nodes ?? [], room.topic));
        setEdges(mapMindMapEdges(map?.edges ?? []));
        setFileTree(nextTree);
        setBoard(nextBoard);
      } catch (error) {
        console.error('Failed to load discussion room:', error);
        if (!cancelled) {
          navigate('/');
        }
      } finally {
        if (!cancelled) {
          setFilesLoading(false);
        }
      }
    };

    void loadDiscussionRoom();

    return () => {
      cancelled = true;
    };
  }, [code, clearMessages, clearMindMap, clearWhiteboard, navigate, setBoard, setEdges, setMessages, setNodes, setRoom]);

  useEffect(() => {
    const handleRoomDissolved = (event: Event) => {
      const payload = (event as CustomEvent<{ roomId?: string; topic?: string }>).detail;
      if (payload?.roomId === currentRoom?.id) {
        clearRoom();
        window.alert(`房间“${payload.topic ?? currentRoom?.topic ?? code}”已被房主解散。`);
        navigate('/');
      }
    };

    window.addEventListener('x-thread-room-dissolved', handleRoomDissolved);
    return () => window.removeEventListener('x-thread-room-dissolved', handleRoomDissolved);
  }, [code, currentRoom?.id, currentRoom?.topic, clearRoom, navigate]);

  const handleSearchMessages = async () => {
    if (!currentRoom?.id) {
      return;
    }

    if (!chatQuery.trim() && !chatFrom && !chatTo) {
      setChatError('');
      await loadLatestMessages(currentRoom.id);
      return;
    }

    setChatBusy(true);
    setChatError('');
    try {
      const nextMessages = await chatService.getMessages(currentRoom.id, {
        take: 200,
        query: chatQuery.trim() || undefined,
        from: toRangeStart(chatFrom),
        to: toRangeEnd(chatTo),
      });
      setChatSearchResults(normalizeMessages(nextMessages as ChatMessage[]));
      setChatSearchActive(true);
    } catch (error: any) {
      setChatError(error?.response?.data?.message ?? '聊天记录查询失败');
    } finally {
      setChatBusy(false);
    }
  };

  const handleResetSearch = async () => {
    setChatQuery('');
    setChatFrom('');
    setChatTo('');
    setChatError('');
    if (currentRoom?.id) {
      setChatBusy(true);
      try {
        await loadLatestMessages(currentRoom.id);
      } finally {
        setChatBusy(false);
      }
    } else {
      setChatSearchActive(false);
      setChatSearchResults([]);
    }
  };

  const handleAskAi = async (
    message: string,
    history: AiConversationMessage[],
    selectedFiles: AiSelectedFile[],
    settings: AiProviderSettings,
  ) => {
    if (!currentRoom?.id) {
      throw new Error('Room is not ready');
    }

    const response = await roomAiService.askQuestion(
      currentRoom.id,
      message,
      history,
      selectedFiles,
      settings,
    );
    return response.answer;
  };

  const handleUploadFile = async (file: File, folderId: string | null) => {
    if (!currentRoom?.id) {
      throw new Error('Room is not ready');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File exceeds 10MB limit');
    }

    const dataBase64 = await readFileAsBase64(file);
    const uploaded = await sharedFileService.uploadFile(currentRoom.id, {
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      dataBase64,
      folderId,
    });

    setFileTree((prev) => ({
      ...prev,
      files: [uploaded, ...prev.files.filter((item) => item.id !== uploaded.id)],
    }));
  };

  const handleCreateFolder = async (name: string, parentId: string | null) => {
    if (!currentRoom?.id) {
      throw new Error('Room is not ready');
    }

    const folder = await sharedFileService.createFolder(currentRoom.id, { name, parentId });
    setFileTree((prev) => ({
      ...prev,
      folders: [...prev.folders.filter((item) => item.id !== folder.id), folder],
    }));
  };

  const handleRenameFolder = async (folderId: string, name: string) => {
    if (!currentRoom?.id) {
      throw new Error('Room is not ready');
    }

    const folder = await sharedFileService.renameFolder(currentRoom.id, folderId, { name });
    setFileTree((prev) => ({
      ...prev,
      folders: prev.folders.map((item) => (item.id === folder.id ? folder : item)),
    }));
  };

  const handleDownloadFile = async (file: SharedFile) => {
    if (!currentRoom?.id) {
      throw new Error('Room is not ready');
    }

    const blob = await sharedFileService.downloadFile(currentRoom.id, file.id);
    downloadBlob(blob, file.filename);
  };

  const handleBatchDownload = async (files: SharedFile[]) => {
    for (const file of files) {
      await handleDownloadFile(file);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  };

  const handleLeaveRoom = async () => {
    if (!currentRoom?.id || roomActionBusy) {
      return;
    }

    setRoomActionBusy(true);
    try {
      await roomService.leaveRoom(currentRoom.id);
      socketService.leaveRoom(currentRoom.id);
      clearRoom();
      navigate('/');
    } catch (error: any) {
      window.alert(error?.response?.data?.message ?? '退出房间失败');
    } finally {
      setRoomActionBusy(false);
    }
  };

  const handleDissolveRoom = async () => {
    if (!currentRoom?.id || roomActionBusy) {
      return;
    }

    const confirmed = window.confirm('解散房间后，所有成员会被移出，历史仅保留 14 天。是否继续？');
    if (!confirmed) {
      return;
    }

    setRoomActionBusy(true);
    try {
      await roomService.dissolveRoom(currentRoom.id);
      clearRoom();
      navigate('/');
    } catch (error: any) {
      window.alert(error?.response?.data?.message ?? '解散房间失败');
    } finally {
      setRoomActionBusy(false);
    }
  };

  const renderMainPanel = () => (
    <div className="h-full min-h-0">
      <div className={activeTab === 'mindmap' ? 'h-full min-h-0 px-6 pb-6 pt-4' : 'hidden'}>
        <MindMap fileTree={fileTree} />
      </div>

      <div className={activeTab === 'ai' ? 'h-full min-h-0 p-6' : 'hidden'}>
        <AiQaPanel onAsk={handleAskAi} fileTree={fileTree} />
      </div>

      <div className={activeTab === 'whiteboard' ? 'h-full min-h-0 p-6' : 'hidden'}>
        {currentRoom?.id && (
          <TextWhiteboard
            roomId={currentRoom.id}
            board={board}
            onBoardChange={setBoard}
          />
        )}
      </div>

      <div className={activeTab === 'files' ? 'h-full min-h-0 p-6' : 'hidden'}>
        <FileSharePanel
          fileTree={fileTree}
          loading={filesLoading}
          onRefresh={() => currentRoom?.id ? loadSharedFiles(currentRoom.id) : Promise.resolve()}
          onUpload={handleUploadFile}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDownload={handleDownloadFile}
          onBatchDownload={handleBatchDownload}
        />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="relative z-10 flex w-[380px] min-w-[340px] flex-col border-r border-slate-200 bg-white shadow-sm">
        <div className="shrink-0 border-b border-slate-200 bg-slate-100 p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800">房间聊天</span>
            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
              房间号 {code}
            </span>
          </div>

          <div className="mt-4 grid gap-2">
            <input
              value={chatQuery}
              onChange={(event) => setChatQuery(event.target.value)}
              placeholder="搜索聊天关键词"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={chatFrom}
                onChange={(event) => setChatFrom(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <input
                type="date"
                value={chatTo}
                onChange={(event) => setChatTo(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleSearchMessages()}
                disabled={chatBusy}
                className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {chatBusy ? '查询中...' : '查询历史'}
              </button>
              <button
                type="button"
                onClick={() => void handleResetSearch()}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                重置
              </button>
            </div>
            {chatSearchActive && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                当前显示的是筛选后的历史记录结果。
              </div>
            )}
            {chatError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {chatError}
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {displayedMessages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.msgType === 'ai_notify' ? 'items-center' : 'items-start'}`}>
              {msg.msgType === 'ai_notify' ? (
                <div className="max-w-xs rounded-full bg-yellow-100 px-3 py-1 text-center text-xs text-yellow-800 shadow-sm">
                  {msg.content}
                </div>
              ) : (
                <div className={`relative max-w-[88%] rounded-2xl p-3 shadow-sm ${
                  msg.type === 'SYSTEM'
                    ? 'rounded-tl-2xl bg-slate-100 text-slate-700'
                    : 'rounded-tl-sm bg-blue-50 text-slate-800'
                }`}>
                  <div className="mb-1 text-xs font-semibold text-blue-600">{msg.nickname || msg.authorId}</div>
                  <div className="text-sm leading-relaxed">{msg.content}</div>
                  <div className="mt-1 text-right text-[10px] text-slate-400">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              )}
            </div>
          ))}

          {displayedMessages.length === 0 && (
            <div className="mt-10 text-center text-sm text-slate-400">
              暂无消息记录
            </div>
          )}
        </div>

        <VoicePanel embedded />
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col bg-gradient-to-br from-blue-50/60 to-cyan-50/40">
        <div className="absolute top-0 z-10 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/90 px-6 shadow-sm backdrop-blur">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Discussion Room</div>
            <h1 className="mt-1 text-lg font-bold text-slate-900">
              {currentRoom?.topic || '未设置主题'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
              {currentRoom?.mode === 'REMOTE' ? '远程模式' : '线下模式'}
            </span>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
              {isOwner ? '房主' : '成员'}
            </span>
            {isOwner ? (
              <button
                type="button"
                onClick={() => void handleDissolveRoom()}
                disabled={roomActionBusy}
                className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                解散房间
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleLeaveRoom()}
                disabled={roomActionBusy}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                退出房间
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate(`/room/${code}/review`)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              结束讨论
            </button>
          </div>
        </div>

        <div className="absolute top-16 z-10 flex h-14 w-full items-center gap-3 border-b border-slate-200 bg-white/80 px-6 backdrop-blur">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 pt-32">{renderMainPanel()}</div>
        <PetWidget roomId={currentRoom?.id} />
      </main>
    </div>
  );
}
