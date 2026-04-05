import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module';
import { MindMapController } from './mindmap.controller';
import { MindMapService } from './mindmap.service';

@Module({
  imports: [RoomsModule],
  controllers: [MindMapController],
  providers: [MindMapService],
  exports: [MindMapService],
})
export class MindMapModule {}
