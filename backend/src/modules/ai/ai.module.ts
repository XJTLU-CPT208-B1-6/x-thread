import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { ChatModule } from '../chat/chat.module';
import { MindMapModule } from '../mindmap/mindmap.module';
import { RoomsModule } from '../rooms/rooms.module';
import { SharedFilesModule } from '../shared-files/shared-files.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [RoomsModule, ChatModule, SharedFilesModule, MindMapModule, AccountModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
