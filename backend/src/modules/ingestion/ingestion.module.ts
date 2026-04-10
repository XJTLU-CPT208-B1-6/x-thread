import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ChatModule } from '../chat/chat.module';
import { MindMapModule } from '../mindmap/mindmap.module';
import { RoomsModule } from '../rooms/rooms.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [AiModule, ChatModule, MindMapModule, RoomsModule],
  controllers: [IngestionController],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
