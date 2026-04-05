import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NodeType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { parseBooleanFlag } from '../../common/utils/query-parsers';
import { MindMapService } from './mindmap.service';

@UseGuards(JwtAuthGuard)
@Controller('rooms/:roomId/mindmap')
export class MindMapController {
  constructor(private readonly mindMapService: MindMapService) {}

  @Get()
  getMap(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Query('history') history?: string,
  ) {
    return this.mindMapService.getRoomMap(roomId, user.userId, {
      allowHistory: parseBooleanFlag(history),
    });
  }

  @Post('nodes')
  createNode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Body() dto: { label: string; type?: NodeType; posX?: number; posY?: number },
  ) {
    return this.mindMapService.createNode(roomId, user.userId, dto);
  }

  @Patch('nodes/:nodeId')
  updateNode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: { label?: string; posX?: number; posY?: number; type?: NodeType },
  ) {
    return this.mindMapService.updateNode(roomId, user.userId, nodeId, dto);
  }

  @Delete('nodes/:nodeId')
  deleteNode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Param('nodeId') nodeId: string,
  ) {
    return this.mindMapService.deleteNode(roomId, user.userId, nodeId);
  }

  @Post('edges')
  createEdge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Body() dto: { sourceId: string; targetId: string; label?: string },
  ) {
    return this.mindMapService.createEdge(roomId, user.userId, dto);
  }

  @Delete('edges/:edgeId')
  deleteEdge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Param('edgeId') edgeId: string,
  ) {
    return this.mindMapService.deleteEdge(roomId, user.userId, edgeId);
  }

  @Put('snapshot')
  replaceSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Body()
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
    return this.mindMapService.replaceSnapshot(roomId, user.userId, dto);
  }
}
