import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module';
import { PetController } from './pet.controller';
import { PetService } from './pet.service';

@Module({
  imports: [RoomsModule],
  controllers: [PetController],
  providers: [PetService],
  exports: [PetService],
})
export class PetModule {}
