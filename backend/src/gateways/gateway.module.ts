import { Global, Module } from '@nestjs/common';
import { ChatModule } from '../modules/chat/chat.module';
import { RoomGateway } from './room.gateway';

@Global()
@Module({
  imports: [ChatModule],
  providers: [RoomGateway],
  exports: [RoomGateway],
})
export class GatewayModule {}
