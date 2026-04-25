import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Clapperboard,
  Maximize2,
  MessageSquareText,
  Minimize2,
  Send,
  Sparkles,
  Users,
  Workflow,
  Files,
  ScrollText,
} from 'lucide-react';
import { AiQaPanel } from '../components/AiQaPanel';
import { FileSharePanel } from '../components/FileSharePanel';
import { MindMap } from '../components/MindMap';
import { PersonalityBadge } from '../components/PersonalityBadge';
import { RemoteVoiceCallPanel } from '../components/RemoteVoiceCallPanel';
import { TextWhiteboard }from '../components/TextWhiteboard.tsx';
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
import { extractLatestAiSummary, resolveStageHint, type RemoteFeatureTab } from '../utils/remoteRoomUi';

type FeatureTab = RemoteFeatureTab;
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
            online: 'Online',
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
            focusMode: 'Single Panel',
            splitMode: 'Split View',
            roomClosed: (topic: string) => `The room "${topic}" was dissolved by the owner.`,
            searchFailed: 'Failed to query chat history',
            leaveFailed: 'Failed to leave room',
            dissolveConfirm: 'Dissolving the room removes every member. History remains for 14 days. Continue?',
            dissolveFailed: 'Failed to dissolve room',
            companionOnline: 'Room pets',
            mentionHint: 'Anyone can mention a pet directly with @name.',
            voiceVideo: 'Voice Chat',
            game: 'Icebreak Game',
            endDiscussion: 'End Discussion',
            aiSummary: 'AI Live Summary',
            aiSummaryEmpty: 'No AI summary yet. The discussion summary will appear here in real time.',
            sendMessage: 'Send message...',
            stageHintVoice: 'Live call room',
            stageHintMap: 'Mind map workspace',
            stageHintAi: 'AI deep discussion',
            stageHintBoard: 'Collaborative whiteboard',
            stageHintFiles: 'Shared files',
            stageHintChat: 'Room chat workspace',
            stageHintGame: 'Icebreak game',
            gameComingSoon: 'Icebreak game panel is under preparation.',
          }
        : {
            roomChat: '房间聊天',
            roomCode: '房间号',
            online: '在线人数',
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
            focusMode: '单面板模式',
            splitMode: '分屏模式',
            roomClosed: (topic: string) => `房间“${topic}”已被房主解散。`,
            searchFailed: '聊天记录查询失败',
            leaveFailed: '退出房间失败',
            dissolveConfirm: '解散房间后，所有成员会被移出，历史仅保留 14 天。是否继续？',
            dissolveFailed: '解散房间失败',
            companionOnline: '房间宠物',
            mentionHint: '成员可以直接通过 @名字 呼叫宠物。',
            voiceVideo: '语音聊天',
            game: '破冰游戏',
            endDiscussion: '结束讨论',
            aiSummary: 'AI 实时摘要',
            aiSummaryEmpty: '暂未生成 AI 摘要，讨论进行中会在此实时更新要点。',
            sendMessage: '发送消息...',
            stageHintVoice: '实时语音会场',
            stageHintMap: '思维导图工作区',
            stageHintAi: 'AI 深度讨论',
            stageHintBoard: '协作白板',
            stageHintFiles: '共享文件',
            stageHintChat: '房间聊天工作区',
            stageHintGame: '破冰互动',
            gameComingSoon: '破冰游戏面板正在准备中。',
          },
    [language],
  );

  const tabs = useMemo(
    () => [
      { id: 'voice' as const, label: copy.voiceVideo, icon: Clapperboard },
      { id: 'chat' as const, label: copy.roomChat, icon: MessageSquareText },
      { id: 'mindmap' as const, label: language === 'en' ? 'Mind Map' : '思维导图', icon: Workflow },
      { id: 'ai' as const, label: 'AI', icon: Sparkles },
      { id: 'whiteboard' as const, label: language === 'en' ? 'Whiteboard' : '文字白板', icon: ScrollText },
      { id: 'files' as const, label: language === 'en' ? 'Files' : '文件共享', icon: Files },
    ],
    [copy.roomChat, copy.voiceVideo, language],
  );

  const { currentRoom, setRoom, clearRoom } = useRoomStore();
  const { user } = useUserStore();
  const { messages, setMessages, clear: clearMessages } = useChatStore();
  const { setNodes, setEdges, clear: clearMindMap } = useMindMapStore();
  const { board, setBoard, clear: clearWhiteboard } = useWhiteboardStore();
  const [activeTab, setActiveTab] = useState<FeatureTab>('voice');
  const [isSplitView, setIsSplitView] = useState(false);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [fileTree, setFileTree] = useState<SharedFileTree>({ folders: [], files: [] });
  const [filesLoading, setFilesLoading] = useState(false);
  const [roomActionBusy, setRoomActionBusy] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [voiceCallState, setVoiceCallState] = useState({ joined: false, joining: false });
  const [voiceFloatPosition, setVoiceFloatPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingVoiceFloat, setIsDraggingVoiceFloat] = useState(false);
  const floatingVoiceHostRef = useRef<HTMLDivElement | null>(null);
  const floatingVoicePanelRef = useRef<HTMLDivElement | null>(null);
  const voiceFloatDragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  useSocket(currentRoom?.id);

  useEffect(() => {
    const syncFullscreen = () => setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const currentMember = useMemo(() => currentRoom?.members?.find((member) => member.userId === user?.id), [currentRoom?.members, user?.id]);
  const isOwner = currentMember?.role === 'OWNER';
  const displayedMessages = messages;
  const remoteVoiceEnabled = currentRoom?.mode === 'REMOTE';

  const loadSharedFiles = async (roomId: string) => {
    setFilesLoading(true);
    try {
      setFileTree(await sharedFileService.listFiles(roomId));
    } finally {
      setFilesLoading(false);
    }
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

  const handleSendChatDraft = () => {
    const message = chatDraft.trim();
    if (!message || !currentRoom?.id) {
      return;
    }
    socketService.sendMessage(currentRoom.id, message);
    setChatDraft('');
  };

  const latestAiSummary = useMemo(
    () => extractLatestAiSummary(displayedMessages),
    [displayedMessages],
  );
  const visibleTabs = useMemo(
    () => (isSplitView ? tabs.filter((tab) => tab.id !== 'chat') : tabs),
    [isSplitView, tabs],
  );
  const workspaceTab = isSplitView && activeTab === 'chat' ? 'voice' : activeTab;
  const stageHint = resolveStageHint(workspaceTab, copy);
  const isFloatingVoiceVisible = workspaceTab !== 'voice' && remoteVoiceEnabled && (voiceCallState.joined || voiceCallState.joining);

  const clampVoiceFloatPosition = (x: number, y: number) => {
    const hostRect = floatingVoiceHostRef.current?.getBoundingClientRect();
    const panelRect = floatingVoicePanelRef.current?.getBoundingClientRect();
    if (!hostRect || !panelRect) {
      return { x, y };
    }
    const maxX = Math.max(0, hostRect.width - panelRect.width);
    const maxY = Math.max(0, hostRect.height - panelRect.height);
    return {
      x: Math.min(Math.max(0, x), maxX),
      y: Math.min(Math.max(0, y), maxY),
    };
  };

  useEffect(() => {
    if (isSplitView && activeTab === 'chat') {
      setActiveTab('voice');
    }
  }, [activeTab, isSplitView]);

  useEffect(() => {
    if (!isFloatingVoiceVisible) {
      setIsDraggingVoiceFloat(false);
      voiceFloatDragRef.current = null;
    }
  }, [isFloatingVoiceVisible]);

  useEffect(() => {
    if (!isDraggingVoiceFloat) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const hostRect = floatingVoiceHostRef.current?.getBoundingClientRect();
      const drag = voiceFloatDragRef.current;
      if (!hostRect || !drag) {
        return;
      }
      const nextX = event.clientX - hostRect.left - drag.offsetX;
      const nextY = event.clientY - hostRect.top - drag.offsetY;
      setVoiceFloatPosition(clampVoiceFloatPosition(nextX, nextY));
    };

    const stopDragging = () => {
      setIsDraggingVoiceFloat(false);
      voiceFloatDragRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [isDraggingVoiceFloat]);

  useEffect(() => {
    if (!voiceFloatPosition) {
      return;
    }

    const handleResize = () => {
      setVoiceFloatPosition((current) => (current ? clampVoiceFloatPosition(current.x, current.y) : current));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [voiceFloatPosition]);

  const handleVoiceFloatPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isFloatingVoiceVisible) {
      return;
    }
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('button')) {
      return;
    }
    const hostRect = floatingVoiceHostRef.current?.getBoundingClientRect();
    const panelRect = floatingVoicePanelRef.current?.getBoundingClientRect();
    if (!hostRect || !panelRect) {
      return;
    }
    const baseX = voiceFloatPosition?.x ?? panelRect.left - hostRect.left;
    const baseY = voiceFloatPosition?.y ?? panelRect.top - hostRect.top;
    voiceFloatDragRef.current = {
      offsetX: event.clientX - hostRect.left - baseX,
      offsetY: event.clientY - hostRect.top - baseY,
    };
    setVoiceFloatPosition(clampVoiceFloatPosition(baseX, baseY));
    setIsDraggingVoiceFloat(true);
    event.preventDefault();
  };


  const renderRemoteSidebar = () => (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-[#1D2433] bg-[#0B1220] text-slate-100 shadow-[0_16px_30px_rgba(15,17,26,0.45)]">
      <div className="flex items-center justify-between border-b border-[#1D2433] px-4 py-4">
        <h3 className="text-lg font-semibold text-white">{copy.roomChat}</h3>
        <span className="text-xs text-slate-400">{copy.roomCode} {code}</span>
      </div>
      <div className="chat-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {displayedMessages.map((msg) => (
          <div key={msg.id} className={msg.msgType === 'ai_notify' ? 'rounded-xl bg-indigo-500/20 px-3 py-2 text-xs text-indigo-100' : 'rounded-xl bg-[#111A2D] px-3 py-2'}>
            {msg.msgType === 'ai_notify' ? (
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 text-indigo-300" />
                <span>{msg.content}</span>
              </div>
            ) : (
              <div>
                <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-300">
                  <span className="font-semibold text-slate-100">{msg.nickname || msg.authorId}</span>
                  {msg.type !== 'SYSTEM' ? <PersonalityBadge value={msg.personalityType ?? null} /> : null}
                </div>
                <div className="text-sm leading-relaxed text-slate-100">{msg.content}</div>
              </div>
            )}
          </div>
        ))}
        {displayedMessages.length === 0 ? <div className="pt-8 text-center text-sm text-slate-400">{copy.noMessages}</div> : null}
        <div className="rounded-xl border-l-4 border-[#6366F1] bg-[rgba(99,102,241,0.18)] px-3 py-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-indigo-100">
            <Sparkles className="h-3.5 w-3.5" />
            {copy.aiSummary}
          </div>
          <div className="text-xs leading-relaxed text-indigo-50">{latestAiSummary?.content ?? copy.aiSummaryEmpty}</div>
        </div>
      </div>
      <div className="border-t border-[#1D2433] p-3">
        <div className="flex items-center gap-2 rounded-xl border border-[#24304A] bg-[#111A2D] p-1.5">
          <input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { handleSendChatDraft(); } }} placeholder={copy.sendMessage} className="w-full bg-transparent px-2 text-sm text-slate-100 outline-none placeholder:text-slate-500" />
          <button type="button" onClick={handleSendChatDraft} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#6366F1] text-white transition hover:bg-indigo-500">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  const renderTabPanel = () => {
    switch (workspaceTab) {
      case 'voice':
        return null;
      case 'ai':
        return <div className="h-full min-h-0 p-4 md:p-6"><AiQaPanel onAsk={handleAskAi} fileTree={fileTree} /></div>;
      case 'whiteboard':
        return <div className="h-full min-h-0 p-4 md:p-6">{currentRoom?.id ? <TextWhiteboard roomId={currentRoom.id} board={board} onBoardChange={setBoard} exportTitle={currentRoom.topic || code || currentRoom.id} /> : null}</div>;
      case 'files':
        return <div className="h-full min-h-0 p-4 md:p-6"><FileSharePanel fileTree={fileTree} loading={filesLoading} onRefresh={() => currentRoom?.id ? loadSharedFiles(currentRoom.id) : Promise.resolve()} onUpload={handleUploadFile} onCreateFolder={handleCreateFolder} onRenameFolder={handleRenameFolder} onDownload={handleDownloadFile} onBatchDownload={handleBatchDownload} /></div>;
      case 'chat':
        return <div className="h-full min-h-0 overflow-hidden p-4 md:p-6">{renderRemoteSidebar()}</div>;
      case 'game':
        return (
          <div className="h-full min-h-0 p-4 md:p-6">
            <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-[#DCE3FF] bg-white text-slate-500">
              {copy.gameComingSoon}
            </div>
          </div>
        );
      case 'mindmap':
      default:
        return (
          <div className="flex h-full min-h-0 flex-col px-4 pb-4 pt-3 md:px-6 md:pb-6 md:pt-4">
            <MindMap fileTree={fileTree} viewportKey={isSplitView ? 'split' : 'single'} />
          </div>
        );
    }
  };

  return (
    <div ref={pageRef} className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-[#F8FAFF]">
      <header className="border-b border-[#E8ECFF] bg-white px-4 py-3 md:px-6">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6366F1]">{copy.discussionRoom}</div>
        <h1 className="text-[36px] font-bold leading-none text-[#0B1454]">{currentRoom?.topic || copy.unsetTopic}</h1>
      </header>

      <div className="px-4 pb-4 pt-3 md:px-6 md:pb-6 md:pt-4">
        <div className="rounded-2xl border border-[#1D2433] bg-[#0F111A] px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-white">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xl font-bold">{currentRoom?.topic || copy.unsetTopic}</span>
              <span className="text-sm text-slate-400">ID: {code}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#1C2435] px-2 py-1 text-xs font-medium text-slate-200">
                <Users className="h-3 w-3" />
                {copy.online} {(currentRoom?.members?.length ?? 0)}/{currentRoom?.maxMembers ?? 0}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition md:text-sm ${activeTab === tab.id ? 'bg-[#6366F1] text-white' : 'bg-[#1C2435] text-slate-300 hover:bg-[#252F45]'}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
              {isOwner ? (
                <button type="button" onClick={() => void handleDissolveRoom()} disabled={roomActionBusy} className="rounded-full bg-[#F43F5E] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60 md:text-sm">
                  {copy.endDiscussion}
                </button>
              ) : (
                <button type="button" onClick={() => void handleLeaveRoom()} disabled={roomActionBusy} className="rounded-full bg-[#F43F5E] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60 md:text-sm">
                  {copy.leave}
                </button>
              )}
              <button type="button" onClick={() => setIsSplitView((current) => !current)} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/15 md:text-sm">
                {isSplitView ? copy.focusMode : copy.splitMode}
              </button>
              <button type="button" onClick={() => void toggleBrowserFullscreen()} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/15 md:text-sm">
                {isBrowserFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {isBrowserFullscreen ? copy.exitFullscreen : copy.fullscreen}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`flex min-h-0 flex-1 flex-col px-4 pb-4 md:px-6 md:pb-6 ${isSplitView ? 'gap-4 lg:flex-row' : ''}`}>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#E6EAFF] bg-white">
          <div className="border-b border-[#EEF1FF] px-4 py-2 text-xs font-semibold text-[#6366F1]">{stageHint}</div>
          <div ref={floatingVoiceHostRef} className="relative min-h-0 flex-1 overflow-hidden">
            <div
              ref={floatingVoicePanelRef}
              className={workspaceTab === 'voice' ? 'h-full min-h-0 p-3 md:p-4' : isFloatingVoiceVisible ? `pointer-events-none absolute z-20 w-[320px] max-w-[calc(100%-2rem)] ${voiceFloatPosition ? '' : 'bottom-4 right-4'}` : 'hidden'}
              style={workspaceTab === 'voice' || !voiceFloatPosition ? undefined : { left: `${voiceFloatPosition.x}px`, top: `${voiceFloatPosition.y}px` }}
            >
              <div className={workspaceTab === 'voice' ? 'h-full min-h-0' : 'pointer-events-auto'}>
                <RemoteVoiceCallPanel
                  roomId={currentRoom?.id}
                  enabled={remoteVoiceEnabled}
                  isOwner={isOwner}
                  roomMembers={currentRoom?.members ?? []}
                  currentUserId={user?.id}
                  compact={workspaceTab !== 'voice'}
                  onCallStateChange={setVoiceCallState}
                  onExpand={() => setActiveTab('voice')}
                  onCompactHeaderPointerDown={handleVoiceFloatPointerDown}
                  compactDragActive={isDraggingVoiceFloat}
                />
              </div>
            </div>
            <div className={workspaceTab === 'voice' ? 'hidden' : 'h-full min-h-0'}>
              {renderTabPanel()}
            </div>
          </div>
        </main>
        {isSplitView ? (
          <div className="h-[52vh] min-h-[420px] max-h-[680px] shrink-0 lg:h-auto lg:w-[320px] xl:w-[360px]">
            {renderRemoteSidebar()}
          </div>
        ) : null}
      </div>
    </div>
  );
}

