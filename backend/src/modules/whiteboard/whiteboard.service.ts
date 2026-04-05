import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { RoomGateway } from '../../gateways/room.gateway';
import { RoomsService } from '../rooms/rooms.service';

export type WhiteboardSnapshot = {
  roomId: string;
  contentHtml: string;
  updatedAt: string | null;
  updatedByUserId: string | null;
  updatedByNickname: string | null;
};

@Injectable()
export class WhiteboardService {
  private readonly storageRoot = join(process.cwd(), 'storage', 'whiteboards');

  constructor(
    private readonly roomsService: RoomsService,
    private readonly roomGateway: RoomGateway,
  ) {}

  async getWhiteboard(
    roomId: string,
    userId: string,
    options?: { allowHistory?: boolean },
  ): Promise<WhiteboardSnapshot> {
    if (options?.allowHistory) {
      await this.roomsService.ensureHistoryAccess(roomId, userId);
    } else {
      await this.roomsService.ensureMembership(roomId, userId);
    }

    return this.readSnapshot(roomId);
  }

  async saveWhiteboard(
    roomId: string,
    userId: string,
    nickname: string,
    dto: { contentHtml?: string },
  ): Promise<WhiteboardSnapshot> {
    await this.roomsService.ensureMembership(roomId, userId);

    const snapshot: WhiteboardSnapshot = {
      roomId,
      contentHtml: this.normalizeContent(dto.contentHtml ?? ''),
      updatedAt: new Date().toISOString(),
      updatedByUserId: userId,
      updatedByNickname: nickname,
    };

    await this.writeSnapshot(roomId, snapshot);
    this.roomGateway.emitWhiteboardUpdated(roomId, snapshot);
    return snapshot;
  }

  private getRoomPath(roomId: string) {
    return join(this.storageRoot, `${roomId}.json`);
  }

  private async readSnapshot(roomId: string): Promise<WhiteboardSnapshot> {
    try {
      const raw = await fs.readFile(this.getRoomPath(roomId), 'utf8');
      const parsed = JSON.parse(raw) as Partial<WhiteboardSnapshot>;

      return {
        roomId,
        contentHtml: typeof parsed.contentHtml === 'string' ? parsed.contentHtml : '',
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
        updatedByUserId:
          typeof parsed.updatedByUserId === 'string' ? parsed.updatedByUserId : null,
        updatedByNickname:
          typeof parsed.updatedByNickname === 'string' ? parsed.updatedByNickname : null,
      };
    } catch {
      return {
        roomId,
        contentHtml: '',
        updatedAt: null,
        updatedByUserId: null,
        updatedByNickname: null,
      };
    }
  }

  private async writeSnapshot(roomId: string, snapshot: WhiteboardSnapshot) {
    await fs.mkdir(this.storageRoot, { recursive: true });
    await fs.writeFile(
      this.getRoomPath(roomId),
      JSON.stringify(snapshot, null, 2),
      'utf8',
    );
  }

  private normalizeContent(contentHtml: string) {
    const trimmed = contentHtml.trim();
    return trimmed === '<br>' ? '' : trimmed;
  }
}
