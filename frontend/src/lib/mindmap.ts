import {
  AiMindMapStructure,
  MindMapApiEdge,
  MindMapApiNode,
  MindMapSnapshotPayload,
} from '../services/api-client';
import { MindMapEdge, MindMapNode, MindMapNodeType } from '../types/mindmap';

export const SYNTHETIC_ROOT_NODE_ID = 'room-topic';

const nodeTypeLabelMap: Record<MindMapNodeType, string> = {
  IDEA: '\u60f3\u6cd5',
  QUESTION: '\u95ee\u9898',
  FACT: '\u4e8b\u5b9e',
  ACTION: '\u884c\u52a8',
};

export const buildSeedNode = (topic: string): MindMapNode => ({
  id: SYNTHETIC_ROOT_NODE_ID,
  type: 'customEntity',
  position: { x: 320, y: 160 },
  draggable: false,
  data: {
    keywordZh: topic,
    keywordEn: '',
    authorUid: 'system',
    authorName: '\u623f\u95f4\u4e3b\u9898',
    status: 'active',
    isCenter: true,
    nodeType: 'IDEA',
    canEdit: false,
    canDelete: false,
  },
});

export const isSyntheticRootNode = (node: { id: string }) => node.id === SYNTHETIC_ROOT_NODE_ID;

export const mapApiNodeToMindMapNode = (
  node: MindMapApiNode,
  options: { isCenter?: boolean } = {},
): MindMapNode => ({
  id: node.id,
  type: 'customEntity',
  position: { x: node.posX ?? 0, y: node.posY ?? 0 },
  data: {
    keywordZh: node.label,
    keywordEn: '',
    authorUid: node.authorId,
    authorName: node.author?.nickname ?? node.authorId,
    authorAvatar: node.author?.avatar ?? undefined,
    status: 'active',
    isCenter: options.isCenter ?? false,
    nodeType: node.type ?? 'IDEA',
    canEdit: true,
    canDelete: true,
  },
});

export const mapMindMapNodes = (nodes: MindMapApiNode[], topic: string): MindMapNode[] => {
  if (nodes.length === 0) {
    return [buildSeedNode(topic)];
  }

  return nodes.map((node, index) => mapApiNodeToMindMapNode(node, { isCenter: index === 0 }));
};

export const mapApiEdgeToMindMapEdge = (edge: MindMapApiEdge): MindMapEdge => ({
  id: edge.id,
  source: edge.sourceId,
  target: edge.targetId,
  label: edge.label ?? undefined,
  data: {
    relationLabel: edge.label ?? '',
    aiGenerated: false,
  },
});

export const mapMindMapEdges = (edges: MindMapApiEdge[]): MindMapEdge[] =>
  edges.map(mapApiEdgeToMindMapEdge);

export type MindMapGraphSnapshot = {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
};

export const cloneSnapshot = (snapshot: MindMapGraphSnapshot): MindMapGraphSnapshot => ({
  nodes: snapshot.nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      canEdit: undefined,
      canDelete: undefined,
      onRequestUpdate: undefined,
      onRequestDelete: undefined,
    },
  })),
  edges: snapshot.edges.map((edge) => ({
    ...edge,
    data: edge.data ? { ...edge.data } : undefined,
  })),
});

export const buildDisplaySnapshot = (
  topic: string,
  nodes: MindMapNode[],
  edges: MindMapEdge[],
): MindMapGraphSnapshot => {
  const realNodes = nodes.filter((node) => !isSyntheticRootNode(node));

  if (realNodes.length === 0) {
    return {
      nodes: [buildSeedNode(topic)],
      edges: [],
    };
  }

  return cloneSnapshot({
    nodes,
    edges: edges.filter(
      (edge) =>
        realNodes.some((node) => node.id === edge.source) &&
        realNodes.some((node) => node.id === edge.target),
    ),
  });
};

export const buildPersistSnapshotPayload = (
  nodes: MindMapNode[],
  edges: MindMapEdge[],
  fallbackAuthorId?: string,
): MindMapSnapshotPayload => {
  const realNodes = nodes.filter((node) => !isSyntheticRootNode(node));
  const nodeIds = new Set(realNodes.map((node) => node.id));

  return {
    nodes: realNodes.map((node) => ({
      id: node.id,
      label: node.data.keywordZh,
      type: node.data.nodeType ?? 'IDEA',
      posX: node.position.x,
      posY: node.position.y,
      authorId: node.data.authorUid || fallbackAuthorId,
    })),
    edges: edges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
        label: edge.data?.relationLabel ?? edge.label?.toString() ?? undefined,
      })),
  };
};

export const snapshotSignature = (snapshot: MindMapGraphSnapshot) =>
  JSON.stringify({
    nodes: snapshot.nodes.map((node) => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      label: node.data.keywordZh,
      type: node.data.nodeType ?? 'IDEA',
    })),
    edges: snapshot.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.data?.relationLabel ?? edge.label ?? '',
    })),
  });

export const applyAutoLayout = (
  nodes: MindMapNode[],
  edges: MindMapEdge[],
): MindMapNode[] => {
  const realNodes = nodes.filter((node) => !isSyntheticRootNode(node));
  if (realNodes.length === 0) {
    return nodes;
  }

  const nodeMap = new Map(realNodes.map((node) => [node.id, node]));
  const children = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const node of realNodes) {
    children.set(node.id, []);
    indegree.set(node.id, 0);
  }

  for (const edge of edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
      continue;
    }

    children.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const sortIds = (ids: string[]) =>
    [...ids].sort((left, right) => {
      const leftNode = nodeMap.get(left);
      const rightNode = nodeMap.get(right);
      if (!leftNode || !rightNode) {
        return left.localeCompare(right);
      }

      if (Boolean(leftNode.data.isCenter) !== Boolean(rightNode.data.isCenter)) {
        return leftNode.data.isCenter ? -1 : 1;
      }

      if (leftNode.position.y !== rightNode.position.y) {
        return leftNode.position.y - rightNode.position.y;
      }

      if (leftNode.position.x !== rightNode.position.x) {
        return leftNode.position.x - rightNode.position.x;
      }

      return left.localeCompare(right);
    });

  for (const [parentId, childIds] of children.entries()) {
    children.set(parentId, sortIds(childIds));
  }

  const rootIds = sortIds(
    realNodes
      .filter((node) => (indegree.get(node.id) ?? 0) === 0)
      .map((node) => node.id),
  );

  const orderedRoots = rootIds.length > 0 ? rootIds : sortIds(realNodes.map((node) => node.id));
  const visited = new Set<string>();
  const levelBuckets = new Map<number, string[]>();

  const enqueue = (nodeId: string, level: number) => {
    if (visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    const bucket = levelBuckets.get(level) ?? [];
    bucket.push(nodeId);
    levelBuckets.set(level, bucket);

    for (const childId of children.get(nodeId) ?? []) {
      enqueue(childId, level + 1);
    }
  };

  for (const rootId of orderedRoots) {
    enqueue(rootId, 0);
  }

  for (const nodeId of sortIds(realNodes.map((node) => node.id))) {
    enqueue(nodeId, 0);
  }

  const horizontalGap = 260;
  const verticalGap = 140;
  const originX = 120;
  const originY = 100;

  const positioned = new Map<string, { x: number; y: number }>();
  const sortedLevels = [...levelBuckets.keys()].sort((left, right) => left - right);

  for (const level of sortedLevels) {
    const bucket = sortIds(levelBuckets.get(level) ?? []);
    bucket.forEach((nodeId, index) => {
      positioned.set(nodeId, {
        x: originX + level * horizontalGap,
        y: originY + index * verticalGap,
      });
    });
  }

  return nodes.map((node) => {
    const position = positioned.get(node.id);
    if (!position) {
      return node;
    }

    return {
      ...node,
      position,
    };
  });
};

export const applyStructuredLayout = (
  nodes: MindMapNode[],
  edges: MindMapEdge[],
  structure: AiMindMapStructure = 'hierarchy',
): MindMapNode[] => {
  const realNodes = nodes.filter((node) => !isSyntheticRootNode(node));
  if (realNodes.length === 0) {
    return nodes;
  }

  if (structure === 'radial') {
    const centerNode =
      realNodes.find((node) => node.data.isCenter) ?? realNodes[0];
    const satellites = realNodes.filter((node) => node.id !== centerNode.id);
    const radius = Math.max(220, satellites.length * 28);

    const positioned = new Map<string, { x: number; y: number }>([
      [centerNode.id, { x: 420, y: 260 }],
    ]);

    satellites.forEach((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, satellites.length);
      positioned.set(node.id, {
        x: 420 + Math.cos(angle) * radius,
        y: 260 + Math.sin(angle) * radius,
      });
    });

    return nodes.map((node) => {
      const position = positioned.get(node.id);
      return position ? { ...node, position } : node;
    });
  }

  if (structure === 'timeline') {
    return nodes.map((node, index) => ({
      ...node,
      position: { x: 120 + index * 240, y: index % 2 === 0 ? 180 : 340 },
    }));
  }

  if (structure === 'compare') {
    return nodes.map((node, index) => {
      if (index === 0) {
        return {
          ...node,
          position: { x: 420, y: 90 },
        };
      }

      const column = index % 2 === 0 ? 620 : 220;
      const row = Math.floor((index - 1) / 2);
      return {
        ...node,
        position: { x: column, y: 220 + row * 150 },
      };
    });
  }

  return applyAutoLayout(nodes, edges);
};

type NodeVisualTheme = {
  containerClassName: string;
  badgeClassName: string;
  metaTextClassName: string;
  bodyClassName: string;
  handleClassName: string;
  actionButtonClassName: string;
};

const typeThemeScale: Record<MindMapNodeType, NodeVisualTheme[]> = {
  IDEA: [
    {
      containerClassName: 'border-sky-700 bg-sky-100 shadow-sky-100/80',
      badgeClassName: 'bg-sky-700 text-white',
      metaTextClassName: 'text-sky-800',
      bodyClassName: 'bg-sky-50',
      handleClassName: 'bg-sky-600',
      actionButtonClassName: 'border-sky-300 text-sky-700 hover:border-sky-500 hover:bg-sky-100',
    },
    {
      containerClassName: 'border-sky-500 bg-sky-50 shadow-sky-100/60',
      badgeClassName: 'bg-sky-600 text-white',
      metaTextClassName: 'text-sky-700',
      bodyClassName: 'bg-white/80',
      handleClassName: 'bg-sky-500',
      actionButtonClassName: 'border-sky-200 text-sky-700 hover:border-sky-400 hover:bg-sky-50',
    },
    {
      containerClassName: 'border-sky-300 bg-white shadow-sky-50/50',
      badgeClassName: 'bg-sky-100 text-sky-800',
      metaTextClassName: 'text-sky-600',
      bodyClassName: 'bg-slate-50',
      handleClassName: 'bg-sky-400',
      actionButtonClassName: 'border-slate-200 text-sky-700 hover:border-sky-300 hover:bg-sky-50',
    },
  ],
  QUESTION: [
    {
      containerClassName: 'border-amber-700 bg-amber-100 shadow-amber-100/80',
      badgeClassName: 'bg-amber-700 text-white',
      metaTextClassName: 'text-amber-800',
      bodyClassName: 'bg-amber-50',
      handleClassName: 'bg-amber-600',
      actionButtonClassName: 'border-amber-300 text-amber-700 hover:border-amber-500 hover:bg-amber-100',
    },
    {
      containerClassName: 'border-amber-500 bg-amber-50 shadow-amber-100/60',
      badgeClassName: 'bg-amber-600 text-white',
      metaTextClassName: 'text-amber-700',
      bodyClassName: 'bg-white/80',
      handleClassName: 'bg-amber-500',
      actionButtonClassName: 'border-amber-200 text-amber-700 hover:border-amber-400 hover:bg-amber-50',
    },
    {
      containerClassName: 'border-amber-300 bg-white shadow-amber-50/50',
      badgeClassName: 'bg-amber-100 text-amber-800',
      metaTextClassName: 'text-amber-600',
      bodyClassName: 'bg-slate-50',
      handleClassName: 'bg-amber-400',
      actionButtonClassName: 'border-slate-200 text-amber-700 hover:border-amber-300 hover:bg-amber-50',
    },
  ],
  FACT: [
    {
      containerClassName: 'border-emerald-700 bg-emerald-100 shadow-emerald-100/80',
      badgeClassName: 'bg-emerald-700 text-white',
      metaTextClassName: 'text-emerald-800',
      bodyClassName: 'bg-emerald-50',
      handleClassName: 'bg-emerald-600',
      actionButtonClassName: 'border-emerald-300 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-100',
    },
    {
      containerClassName: 'border-emerald-500 bg-emerald-50 shadow-emerald-100/60',
      badgeClassName: 'bg-emerald-600 text-white',
      metaTextClassName: 'text-emerald-700',
      bodyClassName: 'bg-white/80',
      handleClassName: 'bg-emerald-500',
      actionButtonClassName: 'border-emerald-200 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50',
    },
    {
      containerClassName: 'border-emerald-300 bg-white shadow-emerald-50/50',
      badgeClassName: 'bg-emerald-100 text-emerald-800',
      metaTextClassName: 'text-emerald-600',
      bodyClassName: 'bg-slate-50',
      handleClassName: 'bg-emerald-400',
      actionButtonClassName: 'border-slate-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50',
    },
  ],
  ACTION: [
    {
      containerClassName: 'border-rose-700 bg-rose-100 shadow-rose-100/80',
      badgeClassName: 'bg-rose-700 text-white',
      metaTextClassName: 'text-rose-800',
      bodyClassName: 'bg-rose-50',
      handleClassName: 'bg-rose-600',
      actionButtonClassName: 'border-rose-300 text-rose-700 hover:border-rose-500 hover:bg-rose-100',
    },
    {
      containerClassName: 'border-rose-500 bg-rose-50 shadow-rose-100/60',
      badgeClassName: 'bg-rose-600 text-white',
      metaTextClassName: 'text-rose-700',
      bodyClassName: 'bg-white/80',
      handleClassName: 'bg-rose-500',
      actionButtonClassName: 'border-rose-200 text-rose-700 hover:border-rose-400 hover:bg-rose-50',
    },
    {
      containerClassName: 'border-rose-300 bg-white shadow-rose-50/50',
      badgeClassName: 'bg-rose-100 text-rose-800',
      metaTextClassName: 'text-rose-600',
      bodyClassName: 'bg-slate-50',
      handleClassName: 'bg-rose-400',
      actionButtonClassName: 'border-slate-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50',
    },
  ],
};

const rootTheme: NodeVisualTheme = {
  containerClassName: 'border-violet-700 bg-violet-100 shadow-violet-100/80',
  badgeClassName: 'bg-violet-700 text-white',
  metaTextClassName: 'text-violet-800',
  bodyClassName: 'bg-violet-50',
  handleClassName: 'bg-violet-600',
  actionButtonClassName: 'border-violet-300 text-violet-700 hover:border-violet-500 hover:bg-violet-100',
};

const getDepthMap = (nodes: MindMapNode[], edges: MindMapEdge[]) => {
  const realNodes = nodes.filter((node) => !isSyntheticRootNode(node));
  const nodeIds = new Set(realNodes.map((node) => node.id));
  const children = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  const depth = new Map<string, number>();

  for (const node of realNodes) {
    children.set(node.id, []);
    indegree.set(node.id, 0);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      continue;
    }

    children.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const queue = realNodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .sort((left, right) => {
      if (Boolean(left.data.isCenter) !== Boolean(right.data.isCenter)) {
        return left.data.isCenter ? -1 : 1;
      }

      return left.id.localeCompare(right.id);
    })
    .map((node) => node.id);

  for (const nodeId of queue) {
    depth.set(nodeId, 0);
  }

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) {
      continue;
    }

    const currentDepth = depth.get(currentId) ?? 0;
    for (const childId of children.get(currentId) ?? []) {
      const nextDepth = currentDepth + 1;
      const prevDepth = depth.get(childId);
      if (prevDepth === undefined || nextDepth < prevDepth) {
        depth.set(childId, nextDepth);
      }

      indegree.set(childId, (indegree.get(childId) ?? 1) - 1);
      if ((indegree.get(childId) ?? 0) <= 0) {
        queue.push(childId);
      }
    }
  }

  for (const node of realNodes) {
    if (!depth.has(node.id)) {
      depth.set(node.id, 0);
    }
  }

  return depth;
};

export const decorateMindMapNodes = (
  nodes: MindMapNode[],
  edges: MindMapEdge[],
): MindMapNode[] => {
  const depthMap = getDepthMap(nodes, edges);

  return nodes.map((node) => {
    if (isSyntheticRootNode(node)) {
      return {
        ...node,
        data: {
          ...node.data,
          depthLevel: 0,
          ...rootTheme,
        },
      };
    }

    const depthLevel = Math.max(0, depthMap.get(node.id) ?? 0);
    const themeScale = typeThemeScale[node.data.nodeType ?? 'IDEA'];
    const theme = themeScale[Math.min(depthLevel, themeScale.length - 1)];

    return {
      ...node,
      data: {
        ...node.data,
        depthLevel,
        ...theme,
      },
    };
  });
};

const sanitizeFileName = (input: string) =>
  input
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'mind-map';

type ExportNode = {
  id: string;
  label: string;
  type: MindMapNodeType;
  author: string;
  position: { x: number; y: number };
};

type ExportEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
};

export const buildMindMapExportPayload = (
  topic: string,
  nodes: MindMapNode[],
  edges: MindMapEdge[],
) => {
  const exportNodes: ExportNode[] = nodes
    .filter((node) => !isSyntheticRootNode(node))
    .map((node) => ({
      id: node.id,
      label: node.data.keywordZh,
      type: node.data.nodeType ?? 'IDEA',
      author: node.data.authorName ?? node.data.authorUid,
      position: node.position,
    }));

  const exportEdges: ExportEdge[] = edges.map((edge) => ({
    id: edge.id,
    sourceId: edge.source,
    targetId: edge.target,
    label: edge.data?.relationLabel ?? edge.label?.toString() ?? '',
  }));

  return {
    topic,
    exportedAt: new Date().toISOString(),
    nodes: exportNodes,
    edges: exportEdges,
  };
};

export const buildMindMapOutline = (
  topic: string,
  nodes: MindMapNode[],
  edges: MindMapEdge[],
) => {
  const payload = buildMindMapExportPayload(topic, nodes, edges);
  const nodeById = new Map(payload.nodes.map((node) => [node.id, node]));
  const children = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const node of payload.nodes) {
    children.set(node.id, []);
    indegree.set(node.id, 0);
  }

  for (const edge of payload.edges) {
    if (!nodeById.has(edge.sourceId) || !nodeById.has(edge.targetId)) {
      continue;
    }

    children.get(edge.sourceId)?.push(edge.targetId);
    indegree.set(edge.targetId, (indegree.get(edge.targetId) ?? 0) + 1);
  }

  const roots = payload.nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .map((node) => node.id);

  const traversalRoots = roots.length > 0 ? roots : payload.nodes.map((node) => node.id);
  const visited = new Set<string>();
  const lines = [
    `# ${topic}`,
    '',
    `\u5bfc\u51fa\u65f6\u95f4\uff1a${new Date(payload.exportedAt).toLocaleString()}`,
    '',
    '## \u7ed3\u6784',
  ];

  const walk = (nodeId: string, depth: number) => {
    const node = nodeById.get(nodeId);
    if (!node) {
      return;
    }

    const prefix = '  '.repeat(depth);
    if (visited.has(nodeId)) {
      lines.push(`${prefix}- ${node.label} [${nodeTypeLabelMap[node.type]}] (\u5df2\u5f15\u7528)`);
      return;
    }

    visited.add(nodeId);
    lines.push(`${prefix}- ${node.label} [${nodeTypeLabelMap[node.type]}]`);

    for (const childId of children.get(nodeId) ?? []) {
      walk(childId, depth + 1);
    }
  };

  for (const rootId of traversalRoots) {
    walk(rootId, 0);
  }

  const remainingNodes = payload.nodes.filter((node) => !visited.has(node.id));
  if (remainingNodes.length > 0) {
    lines.push('', '## \u5176\u4ed6\u8282\u70b9');
    for (const node of remainingNodes) {
      lines.push(`- ${node.label} [${nodeTypeLabelMap[node.type]}]`);
    }
  }

  if (payload.edges.length > 0) {
    lines.push('', '## \u5173\u7cfb');
    for (const edge of payload.edges) {
      const sourceLabel = nodeById.get(edge.sourceId)?.label ?? edge.sourceId;
      const targetLabel = nodeById.get(edge.targetId)?.label ?? edge.targetId;
      const relation = edge.label ? ` (${edge.label})` : '';
      lines.push(`- ${sourceLabel} -> ${targetLabel}${relation}`);
    }
  }

  if (payload.nodes.length > 0) {
    lines.push('', '## \u8282\u70b9\u4fe1\u606f');
    for (const node of payload.nodes) {
      lines.push(
        `- ${node.label} [${nodeTypeLabelMap[node.type]}] / \u521b\u5efa\u8005\uff1a${node.author} / (${Math.round(node.position.x)}, ${Math.round(node.position.y)})`,
      );
    }
  }

  return lines.join('\n');
};

export const downloadTextFile = (
  topic: string,
  suffix: string,
  content: string,
  mimeType: string,
) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFileName(topic)}-${suffix}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
