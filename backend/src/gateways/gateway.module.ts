import { Global, Module } from '@nestjs/common';
import { ChatModule } from '../modules/chat/chat.module';
import { PetModule } from '../modules/pet/pet.module';
import { RoomGateway } from './room.gateway';
import { PetGateway } from './pet.gateway';

@Global()
@Module({
  imports: [ChatModule, PetModule],
  providers: [RoomGateway, PetGateway],
  exports: [RoomGateway, PetGateway],
})
export class GatewayModule {}
