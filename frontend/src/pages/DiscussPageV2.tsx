import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bot,
  LayoutPanelTop,
  Maximize2,
  MessageSquare,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Workflow,
  Files,
  ScrollText,
} from 'lucide-react';
import { AiQaPanel } from '../components/AiQaPanel';
import { FileSharePanel } from '../components/FileSharePanel';
import { MindMap } from '../components/MindMap';
import { PersonalityBadge } from '../components/PersonalityBadge';
import { RemoteVoiceCallPanel } from '../components/RemoteVoiceCallPanel';
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
import { useLanguageStore } from '../stores/useLanguageStore';
import { useMindMapStore } from '../stores/useMindMapStore';
import { useRoomStore } from '../stores/useRoomStore';
import { useUserStore } from '../stores/useUserStore';
import { useWhiteboardStore } from '../stores/useWhiteboardStore';
import { SharedFile, SharedFileTree } from '../types/shared-file';
import { ChatMessage } from '../types/socket-events';

type FeatureTab = 'chat' | 'mindmap' | 'ai' | 'files' | 'whiteboard';
type LayoutMode = 'split' | 'focus';
type MindMapResponse = { nodes?: MindMapApiNode[]; edges?: MindMapApiEdge[] } | null;

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

const toRangeStart = (value: string) => (value ? new Date(`${value}T00:00:00`).toISOString() : undefined);
const toRangeEnd = (value: string) => (value ? new Date(`${value}T23:59:59`).toISOString() : undefined);

export default function DiscussPageV2() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const { language } = useLanguageStore();
  const copy = useMemo(
    () =>
      language === 'en'
        ? {
            roomChat: 'Room Chat',
            roomCode: 'Room Code',
            searchPlaceholder: 'Search chat keywords',
            search: 'Search History',
            searching: 'Searching...',
            reset: 'Reset',
            filtered: 'Showing filtered history results.',
            noMessages: 'No messages yet',
            discussionRoom: 'Discussion Room',
            unsetTopic: 'Untitled Topic',
            remote: 'Remote',
            onsite: 'On-site',
            owner: 'Owner',
            member: 'Member',
            dissolve: 'Dissolve Room',
            leave: 'Leave Room',
            finish: 'Finish Discussion',
            fullscreen: 'Browser Fullscreen',
            exitFullscreen: 'Exit Fullscreen',
            focusMode: 'Focus Mode',
            splitMode: 'Split Layout',
            roomClosed: (topic: string) => `The room "${topic}" was dissolved by the owner.`,
            searchFailed: 'Failed to query chat history',
            leaveFailed: 'Failed to leave room',
            dissolveConfirm: 'Dissolving the room removes every member. History remains for 14 days. Continue?',
            dissolveFailed: 'Failed to dissolve room',
            companionOnline: 'Room pets',
            mentionHint: 'Anyone can mention a pet directly with @name.',
          }
        : {
            roomChat: '房间聊天',
            roomCode: '房间号',
            searchPlaceholder: '搜索聊天关键词',
            search: '查询历史',
            searching: '查询中...',
            reset: '重置',
            filtered: '当前显示的是筛选后的历史记录结果。',
            noMessages: '暂无消息记录',
            discussionRoom: '讨论房间',
            unsetTopic: '未设置主题',
            remote: '远程模式',
            onsite: '线下模式',
            owner: '房主',
            member: '成员',
            dissolve: '解散房间',
            leave: '退出房间',
            finish: '结束讨论',
            fullscreen: '浏览器全屏',
            exitFullscreen: '退出全屏',
            focusMode: '聊天全屏',
            splitMode: '分栏模式',
            roomClosed: (topic: string) => `房间“${topic}”已被房主解散。`,
            searchFailed: '聊天记录查询失败',
            leaveFailed: '退出房间失败',
            dissolveConfirm: '解散房间后，所有成员会被移出，历史仅保留 14 天。是否继续？',
            dissolveFailed: '解散房间失败',
            companionOnline: '房间宠物',
            mentionHint: '成员可以直接通过 @名字 呼叫宠物。',
          },
    [language],
  );

  const tabs = useMemo(
    () => [
      { id: 'chat' as const, label: copy.roomChat, icon: MessageSquare },
      { id: 'mindmap' as const, label: language === 'en' ? 'Mind Map' : '思维导图', icon: Workflow },
      { id: 'ai' as const, label: 'AI', icon: Sparkles },
      { id: 'whiteboard' as const, label: language === 'en' ? 'Whiteboard' : '文字白板', icon: ScrollText },
      { id: 'files' as const, label: language === 'en' ? 'Files' : '文件共享', icon: Files },
    ],
    [copy.roomChat, language],
  );

  const { currentRoom, setRoom, clearRoom } = useRoomStore();
  const { user } = useUserStore();
  const { messages, setMessages, clear: clearMessages } = useChatStore();
  const { setNodes, setEdges, clear: clearMindMap } = useMindMapStore();
  const { board, setBoard, clear: clearWhiteboard } = useWhiteboardStore();
  const [activeTab, setActiveTab] = useState<FeatureTab>('mindmap');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('split');
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
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

  useEffect(() => {
    const handleResize = () => {
      const narrow = window.innerWidth < 1024;
      setIsNarrowScreen(narrow);
      if (narrow) {
        setLayoutMode('focus');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const currentMember = useMemo(() => currentRoom?.members?.find((member) => member.userId === user?.id), [currentRoom?.members, user?.id]);
  const isOwner = currentMember?.role === 'OWNER';
  const displayedMessages = chatSearchActive ? chatSearchResults : messages;
  const activeCompanion = currentRoom?.botEnabled && currentRoom.botProfile ? currentRoom.botProfile : null;
  const activeCompanions = currentRoom?.activeCompanions?.length ? currentRoom.activeCompanions : activeCompanion ? [activeCompanion] : [];
  const useFocusLayout = isNarrowScreen || layoutMode === 'focus';
  const remoteVoiceEnabled = currentRoom?.mode === 'REMOTE';

  const loadSharedFiles = async (roomId: string) => {
    setFilesLoading(true);
    try {
      setFileTree(await sharedFileService.listFiles(roomId));
    } finally {
      setFilesLoading(false);
    }
  };

  const loadLatestMessages = async (roomId: string) => {
    const nextMessages = await chatService.getMessages(roomId, { take: 200 });
    setMessages(normalizeMessages(nextMessages as ChatMessage[]));
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
        if (cancelled) return;
        setRoom(room);

        const [history, map, nextTree, nextBoard] = await Promise.all([
          chatService.getMessages(room.id, { take: 200 }) as Promise<ChatMessage[]>,
          mindMapService.getMap(room.id) as Promise<MindMapResponse>,
          sharedFileService.listFiles(room.id),
          whiteboardService.getBoard(room.id),
        ]);

        if (cancelled) return;
        setMessages(normalizeMessages(history));
        setNodes(mapMindMapNodes(map?.nodes ?? [], room.topic));
        setEdges(mapMindMapEdges(map?.edges ?? []));
        setFileTree(nextTree);
        setBoard(nextBoard);
      } catch (error) {
        if (!cancelled) navigate('/');
      } finally {
        if (!cancelled) setFilesLoading(false);
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
        window.alert(copy.roomClosed(payload.topic ?? currentRoom?.topic ?? code ?? ''));
        navigate('/');
      }
    };
    window.addEventListener('x-thread-room-dissolved', handleRoomDissolved);
    return () => window.removeEventListener('x-thread-room-dissolved', handleRoomDissolved);
  }, [code, copy, currentRoom?.id, currentRoom?.topic, clearRoom, navigate]);

  const handleSearchMessages = async () => {
    if (!currentRoom?.id) return;
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
      setChatError(error?.response?.data?.message ?? copy.searchFailed);
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

  const handleAskAi = async (message: string, history: AiConversationMessage[], selectedFiles: AiSelectedFile[], settings: AiProviderSettings) => {
    if (!currentRoom?.id) throw new Error('Room is not ready');
    const response = await roomAiService.askQuestion(currentRoom.id, message, history, selectedFiles, settings);
    return response.answer;
  };

  const handleUploadFile = async (file: File, folderId: string | null) => {
    if (!currentRoom?.id) throw new Error('Room is not ready');
    if (file.size > 10 * 1024 * 1024) throw new Error('File exceeds 10MB limit');
    const dataBase64 = await readFileAsBase64(file);
    const uploaded = await sharedFileService.uploadFile(currentRoom.id, {
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      dataBase64,
      folderId,
    });
    setFileTree((prev) => ({ ...prev, files: [uploaded, ...prev.files.filter((item) => item.id !== uploaded.id)] }));
  };

  const handleCreateFolder = async (name: string, parentId: string | null) => {
    if (!currentRoom?.id) throw new Error('Room is not ready');
    const folder = await sharedFileService.createFolder(currentRoom.id, { name, parentId });
    setFileTree((prev) => ({ ...prev, folders: [...prev.folders.filter((item) => item.id !== folder.id), folder] }));
  };

  const handleRenameFolder = async (folderId: string, name: string) => {
    if (!currentRoom?.id) throw new Error('Room is not ready');
    const folder = await sharedFileService.renameFolder(currentRoom.id, folderId, { name });
    setFileTree((prev) => ({ ...prev, folders: prev.folders.map((item) => (item.id === folder.id ? folder : item)) }));
  };

  const handleDownloadFile = async (file: SharedFile) => {
    if (!currentRoom?.id) throw new Error('Room is not ready');
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
    if (!currentRoom?.id || roomActionBusy) return;
    setRoomActionBusy(true);
    try {
      await roomService.leaveRoom(currentRoom.id);
      socketService.leaveRoom(currentRoom.id);
      clearRoom();
      navigate('/');
    } catch (error: any) {
      window.alert(error?.response?.data?.message ?? copy.leaveFailed);
    } finally {
      setRoomActionBusy(false);
    }
  };

  const handleDissolveRoom = async () => {
    if (!currentRoom?.id || roomActionBusy) return;
    if (!window.confirm(copy.dissolveConfirm)) return;
    setRoomActionBusy(true);
    try {
      await roomService.dissolveRoom(currentRoom.id);
      clearRoom();
      navigate('/');
    } catch (error: any) {
      window.alert(error?.response?.data?.message ?? copy.dissolveFailed);
    } finally {
      setRoomActionBusy(false);
    }
  };

  const toggleBrowserFullscreen = async () => {
    if (!pageRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await pageRef.current.requestFullscreen();
    }
  };

  const renderChatPanel = () => (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0 border-b border-slate-200 bg-slate-100 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-slate-800">{copy.roomChat}</span>
          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">{copy.roomCode} {code}</span>
        </div>
        <div className="mt-4 grid gap-2">
          <input value={chatQuery} onChange={(event) => setChatQuery(event.target.value)} placeholder={copy.searchPlaceholder} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={chatFrom} onChange={(event) => setChatFrom(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            <input type="date" value={chatTo} onChange={(event) => setChatTo(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void handleSearchMessages()} disabled={chatBusy} className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">{chatBusy ? copy.searching : copy.search}</button>
            <button type="button" onClick={() => void handleResetSearch()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{copy.reset}</button>
          </div>
          {chatSearchActive ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{copy.filtered}</div> : null}
          {chatError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{chatError}</div> : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {activeCompanions.length > 0 ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div className="font-semibold">{copy.companionOnline}: {activeCompanions.map((companion) => `${companion.name}${companion.emoji ?? ''}`).join(', ')}</div>
            <div className="mt-1 text-emerald-700">{copy.mentionHint}</div>
          </div>
        ) : null}

        {displayedMessages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.msgType === 'ai_notify' ? 'items-center' : 'items-start'}`}>
            {msg.msgType === 'ai_notify' ? (
              <div className="max-w-xs rounded-full bg-yellow-100 px-3 py-1 text-center text-xs text-yellow-800 shadow-sm">{msg.content}</div>
            ) : msg.botName ? (
              <div className="relative max-w-[88%] rounded-2xl rounded-tl-sm border border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50 p-3 shadow-sm">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <span className="text-base">{msg.botEmoji ?? '??'}</span>
                  <span>{msg.botName}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-emerald-600">Pet</span>
                </div>
                <div className="text-sm leading-relaxed text-slate-800">{msg.content}</div>
                <div className="mt-1 text-right text-[10px] text-slate-400">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ) : (
              <div className={`relative max-w-[88%] rounded-2xl p-3 shadow-sm ${msg.type === 'SYSTEM' ? 'rounded-tl-2xl bg-slate-100 text-slate-700' : 'rounded-tl-sm bg-blue-50 text-slate-800'}`}>
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-blue-600">
                  <span>{msg.nickname || msg.authorId}</span>
                  {msg.type !== 'SYSTEM' ? <PersonalityBadge value={msg.personalityType ?? null} /> : null}
                </div>
                <div className="text-sm leading-relaxed">{msg.content}</div>
                <div className="mt-1 text-right text-[10px] text-slate-400">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            )}
          </div>
        ))}

        {displayedMessages.length === 0 ? <div className="mt-10 text-center text-sm text-slate-400">{copy.noMessages}</div> : null}
      </div>

      <VoicePanel embedded suggestedMention={activeCompanion?.name} suggestedEmoji={activeCompanion?.emoji} />
    </div>
  );

  const renderTabPanel = () => {
    switch (activeTab) {
      case 'chat':
        return renderChatPanel();
      case 'ai':
        return <div className="h-full min-h-0 p-4 md:p-6"><AiQaPanel onAsk={handleAskAi} fileTree={fileTree} /></div>;
      case 'whiteboard':
        return <div className="h-full min-h-0 p-4 md:p-6">{currentRoom?.id ? <TextWhiteboard roomId={currentRoom.id} board={board} onBoardChange={setBoard} /> : null}</div>;
      case 'files':
        return <div className="h-full min-h-0 p-4 md:p-6"><FileSharePanel fileTree={fileTree} loading={filesLoading} onRefresh={() => currentRoom?.id ? loadSharedFiles(currentRoom.id) : Promise.resolve()} onUpload={handleUploadFile} onCreateFolder={handleCreateFolder} onRenameFolder={handleRenameFolder} onDownload={handleDownloadFile} onBatchDownload={handleBatchDownload} /></div>;
      case 'mindmap':
      default:
        return <div className="h-full min-h-0 px-4 pb-4 pt-3 md:px-6 md:pb-6 md:pt-4"><MindMap fileTree={fileTree} /></div>;
    }
  };

  return (
    <div ref={pageRef} className="flex min-h-[100dvh] flex-col overflow-hidden bg-slate-50 lg:h-[100dvh]">
      <header className="z-10 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{copy.discussionRoom}</div>
            <h1 className="mt-1 text-lg font-bold text-slate-900">{currentRoom?.topic || copy.unsetTopic}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{currentRoom?.mode === 'REMOTE' ? copy.remote : copy.onsite}</span>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">{isOwner ? copy.owner : copy.member}</span>
            {activeCompanions.length > 0 ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">{activeCompanions.length} {copy.companionOnline}</span> : null}
            <button type="button" onClick={() => setLayoutMode((current) => (current === 'split' ? 'focus' : 'split'))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 lg:inline-flex">
              {useFocusLayout ? <PanelLeftOpen className="mr-2 h-4 w-4" /> : <PanelLeftClose className="mr-2 h-4 w-4" />}
              {useFocusLayout ? copy.splitMode : copy.focusMode}
            </button>
            <button type="button" onClick={() => void toggleBrowserFullscreen()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              {isBrowserFullscreen ? <Minimize2 className="mr-2 inline h-4 w-4" /> : <Maximize2 className="mr-2 inline h-4 w-4" />}
              {isBrowserFullscreen ? copy.exitFullscreen : copy.fullscreen}
            </button>
            {isOwner ? (
              <button type="button" onClick={() => void handleDissolveRoom()} disabled={roomActionBusy} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60">{copy.dissolve}</button>
            ) : (
              <button type="button" onClick={() => void handleLeaveRoom()} disabled={roomActionBusy} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">{copy.leave}</button>
            )}
            <button type="button" onClick={() => navigate(`/room/${code}/review`)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">{copy.finish}</button>
          </div>
        </div>
      </header>

      {remoteVoiceEnabled ? (
        <div className="border-b border-slate-200 bg-blue-50/70 px-4 py-4 md:px-6">
          <RemoteVoiceCallPanel roomId={currentRoom?.id} enabled={remoteVoiceEnabled} isOwner={isOwner} />
        </div>
      ) : null}

      {useFocusLayout ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-white/90 px-4 py-3 md:px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="min-h-0 flex-1 bg-gradient-to-br from-blue-50/60 to-cyan-50/40">{renderTabPanel()}</div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="relative z-10 flex w-[380px] min-w-[340px] flex-col border-r border-slate-200 bg-white shadow-sm">{renderChatPanel()}</aside>
          <main className="relative flex min-w-0 flex-1 flex-col bg-gradient-to-br from-blue-50/60 to-cyan-50/40">
            <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur">
              {tabs.filter((tab) => tab.id !== 'chat').map((tab) => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <div className="min-h-0 flex-1">{renderTabPanel()}</div>
          </main>
        </div>
      )}
    </div>
  );
}

