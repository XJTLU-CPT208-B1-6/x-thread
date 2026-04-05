import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  MiniMap,
  Node,
  NodeTypes,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  applyAutoLayout,
  applyStructuredLayout,
  buildDisplaySnapshot,
  buildMindMapExportPayload,
  buildMindMapOutline,
  buildPersistSnapshotPayload,
  cloneSnapshot,
  decorateMindMapNodes,
  downloadTextFile,
  isSyntheticRootNode,
  mapApiEdgeToMindMapEdge,
  mapApiNodeToMindMapNode,
  MindMapGraphSnapshot,
  snapshotSignature,
} from '../lib/mindmap';
import { loadAiSettings } from '../lib/ai-settings';
import {
  AiMindMapStructure,
  AiMindMapStyle,
  AiSelectedFile,
  mindMapService,
  roomAiService,
} from '../services/api-client';
import { useMindMapStore } from '../stores/useMindMapStore';
import { useRoomStore } from '../stores/useRoomStore';
import { useUserStore } from '../stores/useUserStore';
import { MindMapEdge, MindMapNode, MindMapNodeType } from '../types/mindmap';
import { SharedFile, SharedFileTree } from '../types/shared-file';
import { NodeEntity } from './NodeEntity';

const nodeTypes: NodeTypes = {
  customEntity: NodeEntity,
};

const nodeTypeOptions: Array<{ id: MindMapNodeType; label: string; defaultNodeLabel: string }> = [
  { id: 'IDEA', label: '\u60f3\u6cd5', defaultNodeLabel: '\u65b0\u60f3\u6cd5' },
  { id: 'QUESTION', label: '\u95ee\u9898', defaultNodeLabel: '\u5f85\u8ba8\u8bba' },
  { id: 'FACT', label: '\u4e8b\u5b9e', defaultNodeLabel: '\u65b0\u4e8b\u5b9e' },
  { id: 'ACTION', label: '\u884c\u52a8', defaultNodeLabel: '\u5f85\u6267\u884c' },
];

const aiStyleOptions: Array<{ id: AiMindMapStyle; label: string; description: string }> = [
  { id: 'balanced', label: '均衡', description: '覆盖主题的主要分支，适合通用讨论。' },
  { id: 'debate', label: '辩论', description: '突出观点对立、证据与争议点。' },
  { id: 'strategy', label: '策略', description: '突出目标、风险、决策与执行动作。' },
  { id: 'study', label: '学习', description: '突出定义、事实、问题与复习线索。' },
];

const aiStructureOptions: Array<{
  id: AiMindMapStructure;
  label: string;
  description: string;
}> = [
  { id: 'hierarchy', label: '层级', description: '自上而下展开主干与子主题。' },
  { id: 'radial', label: '放射', description: '以中心主题向四周扩散。' },
  { id: 'timeline', label: '时间线', description: '按阶段和先后顺序组织。' },
  { id: 'compare', label: '对比', description: '强调方案、维度与取舍。' },
];

type HistoryEntry = {
  before: MindMapGraphSnapshot;
  after: MindMapGraphSnapshot;
  label: string;
};

const upsertById = <T extends { id: string }>(items: T[], nextItem: T) => {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) {
    return [...items, nextItem];
  }

  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
    if (Array.isArray(message) && message[0]) {
      return message[0];
    }
    if (typeof message === 'string') {
      return message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
};

const formatFileSize = (sizeBytes: number) => {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let size = sizeBytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const isImageFile = (file: Pick<SharedFile, 'mimeType'>) =>
  file.mimeType.startsWith('image/');

type MindMapProps = {
  fileTree?: SharedFileTree;
  readonly?: boolean;
};

const emptyFileTree: SharedFileTree = { folders: [], files: [] };

const MindMapCanvas = ({ fileTree = emptyFileTree, readonly = false }: MindMapProps) => {
  const { currentRoom } = useRoomStore();
  const { user } = useUserStore();
  const { nodes, edges, setNodes, setEdges } = useMindMapStore();
  const { screenToFlowPosition } = useReactFlow();
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(nodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(edges);
  const [activeNodeType, setActiveNodeType] = useState<MindMapNodeType>('IDEA');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [includeChatHistory, setIncludeChatHistory] = useState(true);
  const [showAiFilePicker, setShowAiFilePicker] = useState(false);
  const [selectedAiFileIds, setSelectedAiFileIds] = useState<string[]>([]);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [aiStyle, setAiStyle] = useState<AiMindMapStyle>('balanced');
  const [aiStructure, setAiStructure] = useState<AiMindMapStructure>('hierarchy');
  const dragSnapshotRef = useRef<MindMapGraphSnapshot | null>(null);
  const dragModeRef = useRef<'single' | 'selection' | null>(null);

  const availableAiFiles = [...fileTree.files].sort((left, right) =>
    right.uploadedAt.localeCompare(left.uploadedAt),
  );
  const selectedAiFiles = selectedAiFileIds
    .map((fileId) => availableAiFiles.find((file) => file.id === fileId))
    .filter((file): file is SharedFile => Boolean(file));
  const isRoomOwner = Boolean(
    currentRoom?.members?.some(
      (member) => member.userId === user?.id && member.role === 'OWNER',
    ),
  );

  useEffect(() => {
    setRfNodes(nodes);
  }, [nodes, setRfNodes]);

  useEffect(() => {
    setRfEdges(edges);
  }, [edges, setRfEdges]);

  useEffect(() => {
    setUndoStack([]);
    setRedoStack([]);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setIncludeChatHistory(true);
    setShowAiFilePicker(false);
    setSelectedAiFileIds([]);
    setPanelCollapsed(false);
    setAiStyle('balanced');
    setAiStructure('hierarchy');
    dragSnapshotRef.current = null;
    dragModeRef.current = null;
  }, [currentRoom?.id]);

  useEffect(() => {
    setSelectedAiFileIds((current) =>
      current.filter((fileId) => availableAiFiles.some((file) => file.id === fileId)),
    );
  }, [availableAiFiles]);

  const currentTopic = currentRoom?.topic ?? '\u601d\u7ef4\u5bfc\u56fe';

  const createSnapshot = useCallback(
    (sourceNodes = rfNodes, sourceEdges = rfEdges) =>
      buildDisplaySnapshot(currentTopic, sourceNodes, sourceEdges),
    [currentTopic, rfEdges, rfNodes],
  );

  const applyLocalSnapshot = useCallback(
    (snapshot: MindMapGraphSnapshot) => {
      const normalized = buildDisplaySnapshot(currentTopic, snapshot.nodes, snapshot.edges);
      const nextSnapshot = cloneSnapshot(normalized);
      setRfNodes(nextSnapshot.nodes);
      setRfEdges(nextSnapshot.edges);
      setNodes(nextSnapshot.nodes);
      setEdges(nextSnapshot.edges);
    },
    [currentTopic, setEdges, setNodes, setRfEdges, setRfNodes],
  );

  const persistSnapshot = useCallback(
    async (snapshot: MindMapGraphSnapshot) => {
      if (!currentRoom?.id) {
        return;
      }

      await mindMapService.replaceSnapshot(
        currentRoom.id,
        buildPersistSnapshotPayload(snapshot.nodes, snapshot.edges, user?.id),
      );
    },
    [currentRoom?.id, user?.id],
  );

  const clearSelection = useCallback(() => {
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
  }, []);

  const pushHistory = useCallback((label: string, before: MindMapGraphSnapshot, after: MindMapGraphSnapshot) => {
    const prevSnapshot = cloneSnapshot(before);
    const nextSnapshot = cloneSnapshot(after);
    if (snapshotSignature(prevSnapshot) === snapshotSignature(nextSnapshot)) {
      return;
    }

    setUndoStack((current) => [...current, { label, before: prevSnapshot, after: nextSnapshot }]);
    setRedoStack([]);
  }, []);

  const commitLocalGraph = useCallback(
    (label: string, before: MindMapGraphSnapshot, nextNodes: MindMapNode[], nextEdges: MindMapEdge[]) => {
      const nextSnapshot = buildDisplaySnapshot(currentTopic, nextNodes, nextEdges);
      applyLocalSnapshot(nextSnapshot);
      pushHistory(label, before, nextSnapshot);
      return nextSnapshot;
    },
    [applyLocalSnapshot, currentTopic, pushHistory],
  );

  const ensurePersistentRoot = useCallback(async () => {
    if (!currentRoom?.id) {
      return null;
    }

    const syntheticRoot = rfNodes.find((node) => isSyntheticRootNode(node));
    if (!syntheticRoot) {
      return null;
    }

    const createdRoot = await mindMapService.createNode(currentRoom.id, {
      label: syntheticRoot.data.keywordZh,
      type: 'IDEA',
      posX: syntheticRoot.position.x,
      posY: syntheticRoot.position.y,
    });

    return mapApiNodeToMindMapNode(createdRoot, { isCenter: true });
  }, [currentRoom?.id, rfNodes]);

  const handleCreateNodeAtPosition = useCallback(
    async (position: { x: number; y: number }) => {
      if (!currentRoom?.id) {
        return;
      }

      const beforeSnapshot = createSnapshot();
      setErrorMessage(null);

      let nextNodes = [...rfNodes];
      let nextEdges = [...rfEdges];

      try {
        let rootNode: MindMapNode | null = null;
        if (rfNodes.some((node) => isSyntheticRootNode(node))) {
          rootNode = await ensurePersistentRoot();
          if (rootNode) {
            nextNodes = [rootNode, ...nextNodes.filter((node) => !isSyntheticRootNode(node))];
          }
        }

        const typeConfig = nodeTypeOptions.find((item) => item.id === activeNodeType) ?? nodeTypeOptions[0];
        const createdNode = await mindMapService.createNode(currentRoom.id, {
          label: typeConfig.defaultNodeLabel,
          type: activeNodeType,
          posX: position.x,
          posY: position.y,
        });

        const mappedNode = mapApiNodeToMindMapNode(createdNode);
        nextNodes = upsertById(nextNodes, mappedNode);

        if (rootNode) {
          const createdEdge = await mindMapService.createEdge(currentRoom.id, {
            sourceId: rootNode.id,
            targetId: mappedNode.id,
          });
          nextEdges = upsertById(nextEdges, mapApiEdgeToMindMapEdge(createdEdge));
        }

        commitLocalGraph('create-node', beforeSnapshot, nextNodes, nextEdges);
        setSelectedNodeIds([mappedNode.id]);
        setSelectedEdgeIds([]);
      } catch (error) {
        if (snapshotSignature(beforeSnapshot) !== snapshotSignature(buildDisplaySnapshot(currentTopic, nextNodes, nextEdges))) {
          applyLocalSnapshot(buildDisplaySnapshot(currentTopic, nextNodes, nextEdges));
        }
        setErrorMessage(getErrorMessage(error, '\u65b0\u589e\u8282\u70b9\u5931\u8d25'));
      }
    },
    [activeNodeType, applyLocalSnapshot, commitLocalGraph, createSnapshot, currentRoom?.id, currentTopic, ensurePersistentRoot, rfEdges, rfNodes],
  );

  const handleRenameNode = useCallback(
    async (nodeId: string, label: string) => {
      if (!currentRoom?.id || isSyntheticRootNode({ id: nodeId })) {
        return;
      }

      const beforeSnapshot = createSnapshot();
      setErrorMessage(null);

      try {
        const currentNode = rfNodes.find((node) => node.id === nodeId);
        const updatedNode = await mindMapService.updateNode(currentRoom.id, nodeId, { label });
        const mappedNode = mapApiNodeToMindMapNode(updatedNode, {
          isCenter: currentNode?.data.isCenter,
        });
        commitLocalGraph('rename-node', beforeSnapshot, upsertById(rfNodes, mappedNode), rfEdges);
      } catch (error) {
        const message = getErrorMessage(error, '\u4fdd\u5b58\u8282\u70b9\u5931\u8d25');
        setErrorMessage(message);
        throw new Error(message);
      }
    },
    [commitLocalGraph, createSnapshot, currentRoom?.id, rfEdges, rfNodes],
  );

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      if (!currentRoom?.id || isSyntheticRootNode({ id: nodeId })) {
        return;
      }

      const beforeSnapshot = createSnapshot();
      setErrorMessage(null);

      try {
        await mindMapService.deleteNode(currentRoom.id, nodeId);
        commitLocalGraph(
          'delete-node',
          beforeSnapshot,
          rfNodes.filter((node) => node.id !== nodeId),
          rfEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
        );
        clearSelection();
      } catch (error) {
        const message = getErrorMessage(error, '\u5220\u9664\u8282\u70b9\u5931\u8d25');
        setErrorMessage(message);
        throw new Error(message);
      }
    },
    [clearSelection, commitLocalGraph, createSnapshot, currentRoom?.id, rfEdges, rfNodes],
  );

  const commitDragSnapshot = useCallback(
    async (label: string, nextNodes: MindMapNode[]) => {
      const beforeSnapshot = dragSnapshotRef.current;
      dragSnapshotRef.current = null;

      if (!beforeSnapshot) {
        return;
      }

      const nextSnapshot = buildDisplaySnapshot(currentTopic, nextNodes, rfEdges);
      if (snapshotSignature(beforeSnapshot) === snapshotSignature(nextSnapshot)) {
        return;
      }

      try {
        await persistSnapshot(nextSnapshot);
        applyLocalSnapshot(nextSnapshot);
        pushHistory(label, beforeSnapshot, nextSnapshot);
      } catch (error) {
        applyLocalSnapshot(beforeSnapshot);
        setErrorMessage(getErrorMessage(error, '\u62d6\u52a8\u4f4d\u7f6e\u4fdd\u5b58\u5931\u8d25'));
      }
    },
    [applyLocalSnapshot, currentTopic, persistSnapshot, pushHistory, rfEdges],
  );

  const handleNodeDragStart = useCallback(() => {
    dragModeRef.current = 'single';
    dragSnapshotRef.current = createSnapshot();
  }, [createSnapshot]);

  const handleNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      if (dragModeRef.current === 'selection') {
        return;
      }

      dragModeRef.current = null;
      if (isSyntheticRootNode(node)) {
        dragSnapshotRef.current = null;
        return;
      }

      const nextNodes = rfNodes.map((item) =>
        item.id === node.id
          ? { ...item, position: { x: node.position.x, y: node.position.y } }
          : item,
      );
      await commitDragSnapshot('move-node', nextNodes);
    },
    [commitDragSnapshot, rfNodes],
  );

  const handleSelectionDragStart = useCallback(() => {
    dragModeRef.current = 'selection';
    dragSnapshotRef.current = createSnapshot();
  }, [createSnapshot]);

  const handleSelectionDragStop = useCallback(
    async (_event: React.MouseEvent, movedNodes: MindMapNode[]) => {
      dragModeRef.current = null;

      const movedNodeMap = new Map(
        movedNodes
          .filter((node) => !isSyntheticRootNode(node))
          .map((node) => [node.id, node.position]),
      );

      if (movedNodeMap.size === 0) {
        dragSnapshotRef.current = null;
        return;
      }

      const nextNodes = rfNodes.map((node) => {
        const position = movedNodeMap.get(node.id);
        return position ? { ...node, position } : node;
      });

      await commitDragSnapshot('move-selection', nextNodes);
    },
    [commitDragSnapshot, rfNodes],
  );

  const handleDeleteEdge = useCallback(
    async (edgeId: string) => {
      if (!currentRoom?.id) {
        return;
      }

      const beforeSnapshot = createSnapshot();
      setErrorMessage(null);

      try {
        await mindMapService.deleteEdge(currentRoom.id, edgeId);
        commitLocalGraph(
          'delete-edge',
          beforeSnapshot,
          rfNodes,
          rfEdges.filter((edge) => edge.id !== edgeId),
        );
        clearSelection();
      } catch (error) {
        const message = getErrorMessage(error, '\u5220\u9664\u8fde\u7ebf\u5931\u8d25');
        setErrorMessage(message);
        throw new Error(message);
      }
    },
    [clearSelection, commitLocalGraph, createSnapshot, currentRoom?.id, rfEdges, rfNodes],
  );

  const handleDeleteSelection = useCallback(async () => {
    const removableNodeIds = selectedNodeIds.filter((id) => !isSyntheticRootNode({ id }));
    if (removableNodeIds.length === 0 && selectedEdgeIds.length === 0) {
      return;
    }

    const beforeSnapshot = createSnapshot();
    const nextNodes = rfNodes.filter((node) => !removableNodeIds.includes(node.id));
    const nextEdges = rfEdges.filter(
      (edge) =>
        !selectedEdgeIds.includes(edge.id) &&
        !removableNodeIds.includes(edge.source) &&
        !removableNodeIds.includes(edge.target),
    );
    const nextSnapshot = buildDisplaySnapshot(currentTopic, nextNodes, nextEdges);

    setErrorMessage(null);
    try {
      await persistSnapshot(nextSnapshot);
      applyLocalSnapshot(nextSnapshot);
      pushHistory('delete-selection', beforeSnapshot, nextSnapshot);
      clearSelection();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, '\u6279\u91cf\u5220\u9664\u5931\u8d25'));
    }
  }, [applyLocalSnapshot, clearSelection, createSnapshot, currentTopic, persistSnapshot, pushHistory, rfEdges, rfNodes, selectedEdgeIds, selectedNodeIds]);

  const handleEditSelectedEdge = useCallback(async (edgeId?: string) => {
    const targetEdgeId = edgeId ?? (selectedEdgeIds.length === 1 ? selectedEdgeIds[0] : undefined);
    if (!targetEdgeId) {
      return;
    }

    const currentEdge = rfEdges.find((edge) => edge.id === targetEdgeId);
    if (!currentEdge) {
      return;
    }

    const currentLabel = currentEdge.data?.relationLabel ?? currentEdge.label?.toString() ?? '';
    const nextLabel = window.prompt('\u8bf7\u8f93\u5165\u5173\u7cfb\u6587\u5b57', currentLabel);
    if (nextLabel === null) {
      return;
    }

    const normalizedLabel = nextLabel.trim();
    if (normalizedLabel === currentLabel) {
      return;
    }

    const beforeSnapshot = createSnapshot();
    const nextEdges = rfEdges.map((edge) =>
      edge.id === targetEdgeId
        ? {
            ...edge,
            label: normalizedLabel || undefined,
            data: {
              ...edge.data,
              relationLabel: normalizedLabel,
              aiGenerated: edge.data?.aiGenerated ?? false,
            },
          }
        : edge,
    );
    const nextSnapshot = buildDisplaySnapshot(currentTopic, rfNodes, nextEdges);

    setErrorMessage(null);
    try {
      await persistSnapshot(nextSnapshot);
      applyLocalSnapshot(nextSnapshot);
      pushHistory('edit-edge-label', beforeSnapshot, nextSnapshot);
      setSelectedEdgeIds([targetEdgeId]);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, '\u4fdd\u5b58\u5173\u7cfb\u6587\u5b57\u5931\u8d25'));
    }
  }, [applyLocalSnapshot, createSnapshot, currentTopic, persistSnapshot, pushHistory, rfEdges, rfNodes, selectedEdgeIds]);

  const handleAutoLayout = useCallback(async () => {
    const beforeSnapshot = createSnapshot();
    const nextNodes = applyAutoLayout(rfNodes, rfEdges);
    const nextSnapshot = buildDisplaySnapshot(currentTopic, nextNodes, rfEdges);

    if (snapshotSignature(beforeSnapshot) === snapshotSignature(nextSnapshot)) {
      return;
    }

    setErrorMessage(null);
    try {
      await persistSnapshot(nextSnapshot);
      applyLocalSnapshot(nextSnapshot);
      pushHistory('auto-layout', beforeSnapshot, nextSnapshot);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, '\u81ea\u52a8\u5e03\u5c40\u5931\u8d25'));
    }
  }, [applyLocalSnapshot, createSnapshot, currentTopic, persistSnapshot, pushHistory, rfEdges, rfNodes]);

  const handleUndo = useCallback(async () => {
    const entry = undoStack[undoStack.length - 1];
    if (!entry || historyBusy) {
      return;
    }

    setHistoryBusy(true);
    setErrorMessage(null);

    try {
      await persistSnapshot(entry.before);
      applyLocalSnapshot(entry.before);
      setUndoStack((current) => current.slice(0, -1));
      setRedoStack((current) => [...current, entry]);
      clearSelection();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, '\u64a4\u9500\u5931\u8d25'));
    } finally {
      setHistoryBusy(false);
    }
  }, [applyLocalSnapshot, clearSelection, historyBusy, persistSnapshot, undoStack]);

  const handleRedo = useCallback(async () => {
    const entry = redoStack[redoStack.length - 1];
    if (!entry || historyBusy) {
      return;
    }

    setHistoryBusy(true);
    setErrorMessage(null);

    try {
      await persistSnapshot(entry.after);
      applyLocalSnapshot(entry.after);
      setRedoStack((current) => current.slice(0, -1));
      setUndoStack((current) => [...current, entry]);
      clearSelection();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, '\u91cd\u505a\u5931\u8d25'));
    } finally {
      setHistoryBusy(false);
    }
  }, [applyLocalSnapshot, clearSelection, historyBusy, persistSnapshot, redoStack]);

  useEffect(() => {
    if (readonly) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      if (ctrlOrMeta && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        void handleUndo();
        return;
      }

      if (
        (ctrlOrMeta && event.key.toLowerCase() === 'y') ||
        (ctrlOrMeta && event.shiftKey && event.key.toLowerCase() === 'z')
      ) {
        event.preventDefault();
        void handleRedo();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const hasSelection =
          selectedEdgeIds.length > 0 ||
          selectedNodeIds.some((id) => !isSyntheticRootNode({ id }));
        if (hasSelection) {
          event.preventDefault();
          void handleDeleteSelection();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDeleteSelection, handleRedo, handleUndo, readonly, selectedEdgeIds, selectedNodeIds]);

  const onConnect = useCallback(
    async (params: Edge | Connection) => {
      if (readonly || !currentRoom?.id || !params.source || !params.target) {
        return;
      }

      if (params.source === params.target) {
        setErrorMessage('\u8282\u70b9\u4e0d\u80fd\u8fde\u63a5\u5230\u81ea\u5df1\u3002');
        return;
      }

      if (isSyntheticRootNode({ id: params.source }) || isSyntheticRootNode({ id: params.target })) {
        setErrorMessage('\u8bf7\u5148\u521b\u5efa\u771f\u5b9e\u8282\u70b9\u540e\u518d\u8fde\u7ebf\u3002');
        return;
      }

      if (rfEdges.some((edge) => edge.source === params.source && edge.target === params.target)) {
        return;
      }

      const beforeSnapshot = createSnapshot();
      setErrorMessage(null);

      try {
        const createdEdge = await mindMapService.createEdge(currentRoom.id, {
          sourceId: params.source,
          targetId: params.target,
        });
        commitLocalGraph(
          'create-edge',
          beforeSnapshot,
          rfNodes,
          upsertById(rfEdges, mapApiEdgeToMindMapEdge(createdEdge)),
        );
      } catch (error) {
        setErrorMessage(getErrorMessage(error, '\u8fde\u7ebf\u4fdd\u5b58\u5931\u8d25'));
      }
    },
    [commitLocalGraph, createSnapshot, currentRoom?.id, readonly, rfEdges, rfNodes],
  );

  const interactiveNodes = decorateMindMapNodes(rfNodes, rfEdges).map((node) => ({
    ...node,
    data: {
      ...node.data,
      authorName:
        node.data.authorName ?? (node.data.authorUid === user?.id ? user?.name : node.data.authorUid),
      canEdit: !readonly && !isSyntheticRootNode(node),
      canDelete: !readonly && !isSyntheticRootNode(node),
      onRequestUpdate: !readonly && !isSyntheticRootNode(node) ? handleRenameNode : undefined,
      onRequestDelete: !readonly && !isSyntheticRootNode(node) ? handleDeleteNode : undefined,
    },
  }));

  const handleExportJson = useCallback(() => {
    const topic = currentRoom?.topic ?? 'mind-map';
    const payload = buildMindMapExportPayload(topic, rfNodes, rfEdges);
    downloadTextFile(topic, 'mind-map.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  }, [currentRoom?.topic, rfEdges, rfNodes]);

  const handleExportOutline = useCallback(() => {
    const topic = currentRoom?.topic ?? 'mind-map';
    const outline = buildMindMapOutline(topic, rfNodes, rfEdges);
    downloadTextFile(topic, 'mind-map-outline.md', outline, 'text/markdown;charset=utf-8');
  }, [currentRoom?.topic, rfEdges, rfNodes]);

  const validNodeTypes = new Set<string>(['IDEA', 'QUESTION', 'FACT', 'ACTION']);
  const toNodeType = (t: string): MindMapNodeType =>
    validNodeTypes.has(t) ? (t as MindMapNodeType) : 'IDEA';

  const selectedAiFilesPayload: AiSelectedFile[] = selectedAiFiles.map((file) => ({
    id: file.id,
    filename: file.filename,
    mimeType: file.mimeType,
  }));

  const toggleAiFileSelection = useCallback((fileId: string) => {
    setSelectedAiFileIds((current) =>
      current.includes(fileId)
        ? current.filter((id) => id !== fileId)
        : [...current, fileId],
    );
  }, []);

  const handleAiGenerate = useCallback(async () => {
    if (!currentRoom?.id || aiLoading || readonly || !isRoomOwner) return;
    const settings = loadAiSettings();
    if (!settings.apiKey.trim()) {
      setErrorMessage('请先在 AI 设置页面填写 API Key');
      return;
    }

    setAiLoading(true);
    setErrorMessage(null);
    const beforeSnapshot = createSnapshot();

    try {
      const result = await roomAiService.generateMindMap(
        currentRoom.id,
        {
          includeChatHistory,
          selectedFiles: selectedAiFilesPayload,
          style: aiStyle,
          structure: aiStructure,
        },
        settings,
      );
      if (!result.nodes || result.nodes.length === 0) {
        setErrorMessage('AI 未能生成有效的导图结构');
        return;
      }

      const idMap = new Map<string, string>();
      const nextNodes: MindMapNode[] = result.nodes.map((n, i) => {
        const realId = `ai-${Date.now()}-${i}`;
        idMap.set(n.id, realId);
        return {
          id: realId,
          type: 'customEntity' as const,
          position: { x: 120 + (i % 4) * 260, y: 100 + Math.floor(i / 4) * 140 },
          data: {
            keywordZh: n.label,
            keywordEn: '',
            authorUid: user?.id ?? 'ai',
            authorName: 'AI',
            status: 'active' as const,
            isCenter: i === 0,
            nodeType: toNodeType(n.type),
            canEdit: true,
            canDelete: true,
          },
        };
      });

      const nextEdges: MindMapEdge[] = result.edges
        .filter((e) => idMap.has(e.sourceId) && idMap.has(e.targetId))
        .map((e, i) => ({
          id: `ai-edge-${Date.now()}-${i}`,
          source: idMap.get(e.sourceId)!,
          target: idMap.get(e.targetId)!,
          label: e.label || undefined,
          data: { relationLabel: e.label ?? '', aiGenerated: true },
        }));

      const laid = applyStructuredLayout(nextNodes, nextEdges, aiStructure);
      const nextSnapshot = buildDisplaySnapshot(currentTopic, laid, nextEdges);
      await persistSnapshot(nextSnapshot);
      applyLocalSnapshot(nextSnapshot);
      pushHistory('ai-generate', beforeSnapshot, nextSnapshot);
      clearSelection();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'AI 生成导图失败'));
    } finally {
      setAiLoading(false);
    }
  }, [aiLoading, aiStructure, aiStyle, applyLocalSnapshot, clearSelection, createSnapshot, currentRoom?.id, currentTopic, includeChatHistory, isRoomOwner, persistSnapshot, pushHistory, readonly, selectedAiFilesPayload, user?.id]);

  const handleAiExpand = useCallback(async () => {
    if (!currentRoom?.id || aiLoading || readonly || !isRoomOwner) return;
    const targetId = selectedNodeIds.find((id) => !isSyntheticRootNode({ id }));
    if (!targetId) return;
    const targetNode = rfNodes.find((n) => n.id === targetId);
    if (!targetNode) return;

    const settings = loadAiSettings();
    if (!settings.apiKey.trim()) {
      setErrorMessage('请先在 AI 设置页面填写 API Key');
      return;
    }

    setAiLoading(true);
    setErrorMessage(null);
    const beforeSnapshot = createSnapshot();

    try {
      const existingLabels = rfNodes
        .filter((n) => !isSyntheticRootNode(n))
        .map((n) => n.data.keywordZh);

      const result = await roomAiService.expandNode(
        currentRoom.id,
        targetNode.data.keywordZh,
        existingLabels,
        settings,
      );

      if (!result.nodes || result.nodes.length === 0) {
        setErrorMessage('AI 未能生成扩展节点');
        return;
      }

      let nextNodes = [...rfNodes];
      let nextEdges = [...rfEdges];
      const baseX = targetNode.position.x + 260;
      const baseY = targetNode.position.y - ((result.nodes.length - 1) * 140) / 2;

      result.nodes.forEach((n, i) => {
        const newId = `ai-exp-${Date.now()}-${i}`;
        nextNodes.push({
          id: newId,
          type: 'customEntity',
          position: { x: baseX, y: baseY + i * 140 },
          data: {
            keywordZh: n.label,
            keywordEn: '',
            authorUid: user?.id ?? 'ai',
            authorName: 'AI',
            status: 'active',
            isCenter: false,
            nodeType: toNodeType(n.type),
            canEdit: true,
            canDelete: true,
          },
        });
        nextEdges.push({
          id: `ai-exp-edge-${Date.now()}-${i}`,
          source: targetId,
          target: newId,
          label: result.edges?.[i]?.label || undefined,
          data: {
            relationLabel: result.edges?.[i]?.label ?? '',
            aiGenerated: true,
          },
        });
      });

      nextNodes = applyAutoLayout(nextNodes, nextEdges);
      const nextSnapshot = buildDisplaySnapshot(currentTopic, nextNodes, nextEdges);
      await persistSnapshot(nextSnapshot);
      applyLocalSnapshot(nextSnapshot);
      pushHistory('ai-expand', beforeSnapshot, nextSnapshot);
      clearSelection();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'AI 扩展节点失败'));
    } finally {
      setAiLoading(false);
    }
  }, [aiLoading, applyLocalSnapshot, clearSelection, createSnapshot, currentRoom?.id, currentTopic, isRoomOwner, persistSnapshot, pushHistory, readonly, rfEdges, rfNodes, selectedNodeIds, user?.id]);

  const handleAiOptimize = useCallback(async () => {
    if (!currentRoom?.id || aiLoading || readonly || !isRoomOwner) return;
    const realNodes = rfNodes.filter((n) => !isSyntheticRootNode(n));
    if (realNodes.length < 2) return;

    const settings = loadAiSettings();
    if (!settings.apiKey.trim()) {
      setErrorMessage('请先在 AI 设置页面填写 API Key');
      return;
    }

    setAiLoading(true);
    setErrorMessage(null);
    const beforeSnapshot = createSnapshot();

    try {
      const apiNodes = realNodes.map((n) => ({
        id: n.id,
        label: n.data.keywordZh,
        type: n.data.nodeType ?? 'IDEA',
      }));
      const apiEdges = rfEdges
        .filter((e) => realNodes.some((n) => n.id === e.source) && realNodes.some((n) => n.id === e.target))
        .map((e) => ({
          id: e.id,
          sourceId: e.source,
          targetId: e.target,
          label: e.data?.relationLabel ?? e.label?.toString(),
        }));

      const result = await roomAiService.optimizeMindMap(
        currentRoom.id,
        apiNodes,
        apiEdges,
        {
          includeChatHistory,
          selectedFiles: selectedAiFilesPayload,
        },
        settings,
      );

      const existingNodeMap = new Map(realNodes.map((n) => [n.id, n]));
      const nextNodes: MindMapNode[] = result.nodes.map((n, i) => {
        const existing = existingNodeMap.get(n.id);
        return {
          id: n.id,
          type: 'customEntity' as const,
          position: existing?.position ?? { x: 120 + (i % 4) * 260, y: 100 + Math.floor(i / 4) * 140 },
          data: {
            keywordZh: n.label,
            keywordEn: '',
            authorUid: existing?.data.authorUid ?? user?.id ?? 'ai',
            authorName: existing?.data.authorName ?? 'AI',
            status: 'active' as const,
            isCenter: existing?.data.isCenter ?? i === 0,
            nodeType: toNodeType(n.type),
            canEdit: true,
            canDelete: true,
          },
        };
      });

      const nodeIdSet = new Set(nextNodes.map((n) => n.id));
      const nextEdges: MindMapEdge[] = result.edges
        .filter((e) => nodeIdSet.has(e.sourceId) && nodeIdSet.has(e.targetId))
        .map((e, i) => ({
          id: `ai-opt-edge-${Date.now()}-${i}`,
          source: e.sourceId,
          target: e.targetId,
          label: e.label || undefined,
          data: { relationLabel: e.label ?? '', aiGenerated: true },
        }));

      const laid = applyAutoLayout(nextNodes, nextEdges);
      const nextSnapshot = buildDisplaySnapshot(currentTopic, laid, nextEdges);
      await persistSnapshot(nextSnapshot);
      applyLocalSnapshot(nextSnapshot);
      pushHistory('ai-optimize', beforeSnapshot, nextSnapshot);
      clearSelection();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'AI 优化导图失败'));
    } finally {
      setAiLoading(false);
    }
  }, [aiLoading, applyLocalSnapshot, clearSelection, createSnapshot, currentRoom?.id, currentTopic, includeChatHistory, isRoomOwner, persistSnapshot, pushHistory, readonly, rfEdges, rfNodes, selectedAiFilesPayload, user?.id]);

  const selectedNodeCount = selectedNodeIds.filter((id) => !isSyntheticRootNode({ id })).length;
  const realNodeCount = rfNodes.filter((node) => !isSyntheticRootNode(node)).length;
  const selectedCount = selectedNodeCount + selectedEdgeIds.length;
  const canUseAi = Boolean(currentRoom?.id) && !readonly && isRoomOwner;
  const canAiGenerate = canUseAi && !aiLoading;
  const canAiExpand = canUseAi && !aiLoading && selectedNodeCount === 1;
  const canAiOptimize = canUseAi && !aiLoading && realNodeCount >= 2;

  return (
    <div className="h-full min-h-[560px] w-full overflow-hidden rounded-[8px] border border-slate-200 bg-white">
      <ReactFlow
        nodes={interactiveNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={readonly ? undefined : onConnect}
        onNodeDragStart={readonly ? undefined : handleNodeDragStart}
        onNodeDragStop={readonly ? undefined : handleNodeDragStop}
        onSelectionDragStart={readonly ? undefined : handleSelectionDragStart}
        onSelectionDragStop={readonly ? undefined : handleSelectionDragStop}
        onSelectionChange={({ nodes: selectedNodes, edges: selectedEdges }) => {
          setSelectedNodeIds(selectedNodes.map((node) => node.id));
          setSelectedEdgeIds(selectedEdges.map((edge) => edge.id));
        }}
        onPaneClick={(event) => {
          if (!readonly && event.detail === 2) {
            const position = screenToFlowPosition({
              x: event.clientX,
              y: event.clientY,
            });
            void handleCreateNodeAtPosition(position);
          }
        }}
        onEdgeDoubleClick={(_event, edge) => {
          if (!readonly) {
            void handleEditSelectedEdge(edge.id);
          }
        }}
        nodeTypes={nodeTypes}
        deleteKeyCode={null}
        nodesDraggable={!readonly}
        nodesConnectable={!readonly}
        selectionOnDrag={!readonly}
        selectionMode={SelectionMode.Partial}
        zoomOnDoubleClick={false}
        fitView
      >
        <Panel position="top-left">
          {panelCollapsed ? (
            <button
              type="button"
              onClick={() => setPanelCollapsed(false)}
              className="rounded-full border border-white/80 bg-white/92 px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur"
            >
              {readonly ? '显示查看面板' : '显示编辑面板'}
            </button>
          ) : (
          <div
            className="w-[420px] max-w-[calc(100vw-5rem)] overflow-y-auto rounded-2xl border border-white/80 bg-white/92 p-4 shadow-lg backdrop-blur overscroll-contain"
            style={{ maxHeight: 'calc(100vh - 12rem)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {'\u601d\u7ef4\u5bfc\u56fe\u7f16\u8f91'}
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500">
                  {'\u5728\u7a7a\u767d\u753b\u5e03\u53cc\u51fb\u65b0\u5efa\u8282\u70b9\uff0c\u6846\u9009\u6216 Shift/Ctrl \u591a\u9009\u540e\u53ef\u6279\u91cf\u79fb\u52a8\u548c\u5220\u9664\u3002'}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="text-right text-[11px] text-slate-500">
                  <div>{`\u5df2\u9009\u4e2d ${selectedCount} \u9879`}</div>
                  {!readonly && <div>{`Undo ${undoStack.length} / Redo ${redoStack.length}`}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => setPanelCollapsed(true)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  隐藏
                </button>
              </div>
            </div>

            {!readonly && (
            <div className="mt-3 flex flex-wrap gap-2">
              {nodeTypeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setActiveNodeType(option.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    activeNodeType === option.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            )}

            {!readonly && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleUndo()}
                disabled={undoStack.length === 0 || historyBusy}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {'\u64a4\u9500'}
              </button>
              <button
                type="button"
                onClick={() => void handleRedo()}
                disabled={redoStack.length === 0 || historyBusy}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {'\u91cd\u505a'}
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteSelection()}
                disabled={selectedCount === 0 || historyBusy}
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {'\u6279\u91cf\u5220\u9664'}
              </button>
              <button
                type="button"
                onClick={() => void handleEditSelectedEdge()}
                disabled={selectedEdgeIds.length !== 1 || selectedNodeCount > 0 || historyBusy}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {'\u7f16\u8f91\u5173\u7cfb'}
              </button>
              <button
                type="button"
                onClick={() => void handleAutoLayout()}
                disabled={historyBusy || realNodeCount < 2}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {'\u81ea\u52a8\u5e03\u5c40'}
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={handleExportOutline}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
              >
                {'\u5bfc\u51fa\u5927\u7eb2'}
              </button>
            </div>
            )}

            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-blue-900">
                    {'AI 辅助'}
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-blue-700">
                    {'生成整张导图，或对当前选中节点做扩展，也可以整体优化现有结构。'}
                  </div>
                </div>

                {aiLoading && (
                  <div className="text-[11px] font-medium text-blue-700">
                    {'AI 处理中...'}
                  </div>
                )}
              </div>

              {!isRoomOwner && !readonly && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                  只有房主可以使用 AI 修改思维导图。
                </div>
              )}

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-blue-100 bg-white/80 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500">
                    Style
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {aiStyleOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setAiStyle(option.id)}
                        disabled={!isRoomOwner || readonly}
                        title={option.description}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                          aiStyle === option.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-blue-100 bg-white/80 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500">
                    Structure
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {aiStructureOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setAiStructure(option.id)}
                        disabled={!isRoomOwner || readonly}
                        title={option.description}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                          aiStructure === option.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleAiGenerate()}
                  disabled={!canAiGenerate}
                  className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {'AI 生成导图'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleAiExpand()}
                  disabled={!canAiExpand}
                  className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {'AI 扩展节点'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleAiOptimize()}
                  disabled={!canAiOptimize}
                  className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {'AI 优化结构'}
                </button>
              </div>

              <label className="mt-3 flex items-center gap-2 rounded-xl border border-blue-100 bg-white/80 px-3 py-2 text-[11px] text-blue-800">
                <input
                  type="checkbox"
                  checked={includeChatHistory}
                  onChange={(event) => setIncludeChatHistory(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                />
                {'\u751f\u6210/\u4f18\u5316\u65f6\u5305\u542b\u6700\u8fd1\u804a\u5929\u8bb0\u5f55'}
              </label>

              <div className="mt-3 rounded-xl border border-blue-100 bg-white/80 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500">
                      File Context
                    </div>
                    <div className="mt-1 text-[11px] leading-5 text-blue-700">
                      {'\u53ef\u9009\u62e9\u5df2\u4e0a\u4f20\u6587\u4ef6\uff0cAI \u4f1a\u5c3d\u91cf\u57fa\u4e8e\u6587\u4ef6\u5185\u5bb9\u751f\u6210\u6216\u4f18\u5316\u5bfc\u56fe\u3002'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-[11px] text-blue-700">
                      {selectedAiFiles.length > 0 ? `${selectedAiFiles.length} selected` : 'No files'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAiFilePicker((current) => !current)}
                      disabled={!isRoomOwner || readonly}
                      className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                    >
                      {showAiFilePicker ? '\u6536\u8d77' : '\u9009\u62e9\u6587\u4ef6'}
                    </button>
                  </div>
                </div>

                {selectedAiFiles.length > 0 && (
                  <div className="mt-3 flex max-h-24 flex-wrap gap-2 overflow-y-auto">
                    {selectedAiFiles.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => toggleAiFileSelection(file.id)}
                        disabled={!isRoomOwner || readonly}
                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {file.filename}
                      </button>
                    ))}
                  </div>
                )}

                {showAiFilePicker && (
                  <div className="mt-3 rounded-xl border border-blue-100 bg-slate-50 p-2">
                    {availableAiFiles.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-slate-400">
                        {'\u5f53\u524d\u623f\u95f4\u8fd8\u6ca1\u6709\u5df2\u4e0a\u4f20\u6587\u4ef6\u3002'}
                      </div>
                    ) : (
                      <div className="max-h-44 space-y-2 overflow-y-auto">
                        {availableAiFiles.map((file) => {
                          const selected = selectedAiFileIds.includes(file.id);

                          return (
                            <button
                              key={file.id}
                              type="button"
                              onClick={() => toggleAiFileSelection(file.id)}
                              disabled={!isRoomOwner || readonly}
                              className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                                selected
                                  ? 'border-blue-300 bg-blue-50'
                                  : 'border-slate-200 bg-white hover:bg-slate-100'
                              } disabled:cursor-not-allowed disabled:opacity-40`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-sm font-medium text-slate-900">
                                    {file.filename}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                                    {isImageFile(file) ? 'Image' : 'File'}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {file.uploaderNickname} | {formatFileSize(file.sizeBytes)}
                                </div>
                              </div>
                              <span
                                className={`ml-3 rounded-full px-2 py-1 text-xs font-medium ${
                                  selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {selected ? '\u5df2\u9009' : '\u9009\u62e9'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-500">
              {'\u5feb\u6377\u952e\uff1aCtrl+Z \u64a4\u9500\uff0cCtrl+Y \u6216 Ctrl+Shift+Z \u91cd\u505a\uff0cDelete \u6279\u91cf\u5220\u9664\uff0c\u53cc\u51fb\u8fde\u7ebf\u53ef\u76f4\u63a5\u7f16\u8f91\u5173\u7cfb\u6587\u5b57\u3002'}
            </div>

            {errorMessage && (
              <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
                {errorMessage}
              </div>
            )}
          </div>
          )}
        </Panel>
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
};

export const MindMap = ({ fileTree, readonly = false }: MindMapProps) => (
  <ReactFlowProvider>
    <MindMapCanvas fileTree={fileTree} readonly={readonly} />
  </ReactFlowProvider>
);
