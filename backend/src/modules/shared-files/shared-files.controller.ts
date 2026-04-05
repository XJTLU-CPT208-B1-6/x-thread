import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { parseBooleanFlag } from '../../common/utils/query-parsers';
import { SharedFilesService } from './shared-files.service';

@UseGuards(JwtAuthGuard)
@Controller('rooms/:roomId/files')
export class SharedFilesController {
  constructor(private readonly sharedFilesService: SharedFilesService) {}

  @Get()
  listFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Query('history') history?: string,
  ) {
    return this.sharedFilesService.listFiles(roomId, user.userId, {
      allowHistory: parseBooleanFlag(history),
    });
  }

  @Post()
  uploadFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Body() dto: { filename: string; mimeType?: string; dataBase64: string; folderId?: string | null },
  ) {
    return this.sharedFilesService.uploadFile(roomId, user.userId, user.nickname, dto);
  }

  @Post('folders')
  createFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Body() dto: { name: string; parentId?: string | null },
  ) {
    return this.sharedFilesService.createFolder(roomId, user.userId, user.nickname, dto);
  }

  @Patch('folders/:folderId')
  renameFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Param('folderId') folderId: string,
    @Body() dto: { name: string },
  ) {
    return this.sharedFilesService.renameFolder(roomId, user.userId, folderId, dto);
  }

  @Get(':fileId/download')
  @Header('Cache-Control', 'no-store')
  async downloadFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Param('fileId') fileId: string,
    @Query('history') history: string | undefined,
    @Res({ passthrough: true }) reply: any,
  ) {
    const { record, stream } = await this.sharedFilesService.getDownload(
      roomId,
      user.userId,
      fileId,
      {
        allowHistory: parseBooleanFlag(history),
      },
    );

    reply.header(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(record.filename)}`,
    );
    reply.header('Content-Type', record.mimeType);
    reply.header('Content-Length', String(record.sizeBytes));

    return new StreamableFile(stream);
  }
}
