import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GatewayModule } from './gateways/gateway.module';
import { PrismaModule } from './prisma/prisma.module';
import { AccountModule } from './modules/account/account.module';
import { AuthModule } from './modules/auth/auth.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { MindMapModule } from './modules/mindmap/mindmap.module';
import { ChatModule } from './modules/chat/chat.module';
import { AiModule } from './modules/ai/ai.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { SharedFilesModule } from './modules/shared-files/shared-files.module';
import { WhiteboardModule } from './modules/whiteboard/whiteboard.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GatewayModule,
    PrismaModule,
    AccountModule,
    AuthModule,
    RoomsModule,
    MindMapModule,
    ChatModule,
    AiModule,
    IngestionModule,
    SharedFilesModule,
    WhiteboardModule,
    AdminModule,
  ],
})
export class AppModule {}
