import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../modules/auth/auth.module';
import { AccountModule } from '../modules/account/account.module';
import { AiModule } from '../modules/ai/ai.module';
import { ChatModule } from '../modules/chat/chat.module';
import { RoomsModule } from '../modules/rooms/rooms.module';
import { RoomBotService } from './room-bot.service';
import { RoomGateway } from './room.gateway';

@Global()
@Module({
  imports: [AuthModule, AccountModule, AiModule, ChatModule, RoomsModule],
  providers: [RoomGateway, RoomBotService],
  exports: [RoomGateway],
})
export class GatewayModule {}
