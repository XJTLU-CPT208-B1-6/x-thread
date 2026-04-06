import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { GatewayModule } from '../../gateways/gateway.module';

@Module({
  imports: [PrismaModule, GatewayModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
