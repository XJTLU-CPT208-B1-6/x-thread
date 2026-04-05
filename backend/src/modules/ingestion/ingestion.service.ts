import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  InputEventKind,
  InputEventStatus,
  MessageType,
  PetMood,
} from '@prisma/client';
import { RoomGateway } from '../../gateways/room.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ChatService } from '../chat/chat.service';
import { MindMapService } from '../mindmap/mindmap.service';
import { PetService } from '../pet/pet.service';
import { RoomsService } from '../rooms/rooms.service';

@Injectable()
export class IngestionService {
  constructor(
    private prisma: PrismaService,
    private roomsService: RoomsService,
    private chatService: ChatService,
    private mindMapService: MindMapService,
    private petService: PetService,
    private aiService: AiService,
    private roomGateway: RoomGateway,
  ) {}

  async listRecent(roomId: string, userId: string, take = 20) {
    await this.roomsService.ensureMembership(roomId, userId);
    return this.prisma.inputEvent.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async acceptInput(
    roomId: string,
    userId: string,
    dto: {
      content: string;
      kind?: InputEventKind;
      source?: string;
      metadata?: any;
    },
  ) {
    await this.roomsService.ensureMembership(roomId, userId);
    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Content is required');
    }

    const inputEvent = await this.prisma.inputEvent.create({
      data: {
        roomId,
        authorId: userId,
        content,
        kind: dto.kind ?? InputEventKind.TEXT,
        source: dto.source,
        metadata: dto.metadata as any,
        status: InputEventStatus.ACCEPTED,
      },
    });

    this.roomGateway.emitInputStatus(roomId, {
      inputEventId: inputEvent.id,
      status: inputEvent.status,
    });

    void this.processInputEvent(inputEvent.id);

    return {
      inputEventId: inputEvent.id,
      status: inputEvent.status,
    };
  }

  private async processInputEvent(inputEventId: string) {
    const event = await this.prisma.inputEvent.findUnique({
      where: { id: inputEventId },
      include: {
        author: {
          select: {
            id: true,
            nickname: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Input event not found');
    }

    await this.prisma.inputEvent.update({
      where: { id: inputEventId },
      data: { status: InputEventStatus.PROCESSING },
    });
    this.roomGateway.emitInputStatus(event.roomId, {
      inputEventId,
      status: InputEventStatus.PROCESSING,
    });

    try {
      const message = await this.chatService.createMessage(
        event.roomId,
        event.authorId ?? null,
        event.content,
        this.toMessageType(event.kind),
      );
      this.roomGateway.emitMessage(event.roomId, message);

      const extraction = await this.aiService.extractConcepts(event.content);
      const concepts = extraction.concepts ?? [];
      const nodes =
        event.authorId && concepts.length > 0
          ? await this.mindMapService.createConceptNodes(
              event.roomId,
              event.authorId,
              concepts,
            )
          : [];

      for (const node of nodes) {
        this.roomGateway.emitNodeAdded(event.roomId, node);
      }

      const pet = await this.petService.updateMood(
        event.roomId,
        concepts.length > 0 ? PetMood.EXCITED : PetMood.HAPPY,
      );
      this.roomGateway.emitPetUpdated(event.roomId, pet);

      await this.prisma.inputEvent.update({
        where: { id: inputEventId },
        data: {
          status: InputEventStatus.COMPLETED,
          processedAt: new Date(),
        },
      });

      this.roomGateway.emitInputStatus(event.roomId, {
        inputEventId,
        status: InputEventStatus.COMPLETED,
        conceptCount: nodes.length,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown processing error';
      await this.prisma.inputEvent.update({
        where: { id: inputEventId },
        data: {
          status: InputEventStatus.FAILED,
          errorMessage: message,
        },
      });

      this.roomGateway.emitInputStatus(event.roomId, {
        inputEventId,
        status: InputEventStatus.FAILED,
        errorMessage: message,
      });
    }
  }

  private toMessageType(kind: InputEventKind) {
    if (kind === InputEventKind.VOICE_TRANSCRIPT) {
      return MessageType.VOICE_TRANSCRIPT;
    }
    return MessageType.TEXT;
  }
}
