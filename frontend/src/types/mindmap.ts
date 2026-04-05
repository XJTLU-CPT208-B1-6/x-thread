import { Node, Edge } from '@xyflow/react';

export type MindMapNodeType = 'IDEA' | 'QUESTION' | 'FACT' | 'ACTION';

export interface MindMapNodeData extends Record<string, unknown> {
  keywordZh: string;
  keywordEn?: string;
  authorUid: string;
  authorName?: string;
  authorAvatar?: string;
  status: 'active' | 'discarded';
  isCenter?: boolean;
  nodeType?: MindMapNodeType;
  canEdit?: boolean;
  canDelete?: boolean;
  onRequestUpdate?: (nodeId: string, label: string) => Promise<void>;
  onRequestDelete?: (nodeId: string) => Promise<void>;
  depthLevel?: number;
  containerClassName?: string;
  badgeClassName?: string;
  metaTextClassName?: string;
  bodyClassName?: string;
  handleClassName?: string;
  actionButtonClassName?: string;
}

export type MindMapNode = Node<MindMapNodeData, 'customEntity'>;

export interface MindMapEdgeData extends Record<string, unknown> {
  relationLabel: string;
  aiGenerated: boolean;
}

export type MindMapEdge = Edge<MindMapEdgeData>;
