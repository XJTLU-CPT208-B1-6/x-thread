import { Injectable } from '@nestjs/common';
import { NodeType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RoomsService } from '../rooms/rooms.service';

@Injectable()
export class MindMapService {
  constructor(
    private prisma: PrismaService,
    private roomsService: RoomsService,
  ) {}

  async getRoomMap(roomId: string, userId: string, options?: { allowHistory?: boolean }) {
    if (options?.allowHistory) {
      await this.roomsService.ensureHistoryAccess(roomId, userId);
    } else {
      await this.roomsService.ensureMembership(roomId, userId);
    }

    return this.prisma.room.findUnique({
      where: { id: roomId },
      select: {
        nodes: { include: { author: { select: { id: true, nickname: true, avatar: true } } } },
        edges: true,
      },
    });
  }

  async createNode(
    roomId: string,
    authorId: string,
    dto: { label: string; type?: NodeType; posX?: number; posY?: number },
  ) {
    await this.roomsService.ensureMembership(roomId, authorId);
    return this.prisma.mindMapNode.create({
      data: {
        roomId,
        authorId,
        label: dto.label,
        type: dto.type ?? NodeType.IDEA,
        posX: dto.posX ?? 0,
        posY: dto.posY ?? 0,
      },
      include: {
        author: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
    });
  }

  async updateNode(
    roomId: string,
    userId: string,
    nodeId: string,
    dto: { label?: string; posX?: number; posY?: number; type?: NodeType },
  ) {
    await this.roomsService.ensureMembership(roomId, userId);
    const data: Prisma.MindMapNodeUpdateInput = {};

    if (dto.label !== undefined) {
      data.label = dto.label;
    }
    if (dto.posX !== undefined) {
      data.posX = dto.posX;
    }
    if (dto.posY !== undefined) {
      data.posY = dto.posY;
    }
    if (dto.type !== undefined) {
      data.type = dto.type;
    }

    return this.prisma.mindMapNode.update({
      where: { id: nodeId },
      data,
      include: {
        author: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
    });
  }

  async deleteNode(roomId: string, userId: string, nodeId: string) {
    await this.roomsService.ensureMembership(roomId, userId);
    return this.prisma.mindMapNode.delete({ where: { id: nodeId } });
  }

  async createEdge(
    roomId: string,
    userId: string,
    dto: { sourceId: string; targetId: string; label?: string },
  ) {
    await this.roomsService.ensureMembership(roomId, userId);
    return this.prisma.mindMapEdge.create({ data: { roomId, ...dto } });
  }

  async deleteEdge(roomId: string, userId: string, edgeId: string) {
    await this.roomsService.ensureMembership(roomId, userId);
    return this.prisma.mindMapEdge.delete({ where: { id: edgeId } });
  }

  async replaceSnapshot(
    roomId: string,
    userId: string,
    dto: {
      nodes?: Array<{
        id: string;
        label: string;
        type?: NodeType;
        posX?: number;
        posY?: number;
        authorId?: string;
      }>;
      edges?: Array<{
        id: string;
        sourceId: string;
        targetId: string;
        label?: string;
      }>;
    },
  ) {
    await this.roomsService.ensureMembership(roomId, userId);

    const nodes = dto.nodes ?? [];
    const edges = (dto.edges ?? []).filter(
      (edge) =>
        nodes.some((node) => node.id === edge.sourceId) &&
        nodes.some((node) => node.id === edge.targetId),
    );

    await this.prisma.$transaction(async (tx) => {
      const nextEdgeIds = edges.map((edge) => edge.id);
      if (nextEdgeIds.length > 0) {
        await tx.mindMapEdge.deleteMany({
          where: {
            roomId,
            id: { notIn: nextEdgeIds },
          },
        });
      } else {
        await tx.mindMapEdge.deleteMany({ where: { roomId } });
      }

      const nextNodeIds = nodes.map((node) => node.id);
      if (nextNodeIds.length > 0) {
        await tx.mindMapNode.deleteMany({
          where: {
            roomId,
            id: { notIn: nextNodeIds },
          },
        });
      } else {
        await tx.mindMapNode.deleteMany({ where: { roomId } });
      }

      for (const node of nodes) {
        await tx.mindMapNode.upsert({
          where: { id: node.id },
          update: {
            label: node.label,
            type: node.type ?? NodeType.IDEA,
            posX: node.posX ?? 0,
            posY: node.posY ?? 0,
            authorId: node.authorId ?? userId,
            roomId,
          },
          create: {
            id: node.id,
            roomId,
            authorId: node.authorId ?? userId,
            label: node.label,
            type: node.type ?? NodeType.IDEA,
            posX: node.posX ?? 0,
            posY: node.posY ?? 0,
          },
        });
      }

      for (const edge of edges) {
        await tx.mindMapEdge.upsert({
          where: { id: edge.id },
          update: {
            sourceId: edge.sourceId,
            targetId: edge.targetId,
            label: edge.label,
            roomId,
          },
          create: {
            id: edge.id,
            roomId,
            sourceId: edge.sourceId,
            targetId: edge.targetId,
            label: edge.label,
          },
        });
      }
    });

    return this.getRoomMap(roomId, userId);
  }

  async createConceptNodes(roomId: string, authorId: string, concepts: string[]) {
    await this.roomsService.ensureMembership(roomId, authorId);
    const uniqueConcepts = Array.from(
      new Set(
        concepts
          .map((concept) => concept.trim())
          .filter(Boolean)
          .slice(0, 6),
      ),
    );

    const createdNodes = [];
    for (const [index, concept] of uniqueConcepts.entries()) {
      const node = await this.prisma.mindMapNode.create({
        data: {
          roomId,
          authorId,
          label: concept,
          type: NodeType.IDEA,
          posX: 160 * Math.cos(index),
          posY: 160 * Math.sin(index),
        },
        include: {
          author: {
            select: { id: true, nickname: true, avatar: true },
          },
        },
      });
      createdNodes.push(node);
    }

    return createdNodes;
  }
}
