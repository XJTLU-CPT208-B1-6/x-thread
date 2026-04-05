import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module';
import { SharedFilesController } from './shared-files.controller';
import { SharedFilesService } from './shared-files.service';

@Module({
  imports: [RoomsModule],
  controllers: [SharedFilesController],
  providers: [SharedFilesService],
  exports: [SharedFilesService],
})
export class SharedFilesModule {}
