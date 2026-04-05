import { create } from 'zustand';
import { MindMapNode, MindMapEdge } from '../types/mindmap';

interface MindMapStore {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  setNodes: (nodes: MindMapNode[]) => void;
  setEdges: (edges: MindMapEdge[]) => void;
  addNode: (node: MindMapNode) => void;
  updateNode: (id: string, patch: Partial<MindMapNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: MindMapEdge) => void;
  removeEdge: (id: string) => void;
  clear: () => void;
}

const upsertById = <T extends { id: string }>(items: T[], nextItem: T) => {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) {
    return [...items, nextItem];
  }

  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
};

export const useMindMapStore = create<MindMapStore>((set) => ({
  nodes: [],
  edges: [],
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  addNode: (node) => set((s) => ({ nodes: upsertById(s.nodes, node) })),
  updateNode: (id, patch) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),
  removeNode: (id) =>
    set((s) => ({ nodes: s.nodes.filter((n) => n.id !== id), edges: s.edges.filter((e) => e.source !== id && e.target !== id) })),
  addEdge: (edge) => set((s) => ({ edges: upsertById(s.edges, edge) })),
  removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),
  clear: () => set({ nodes: [], edges: [] }),
}));
