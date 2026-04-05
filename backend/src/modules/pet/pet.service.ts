import { Injectable } from '@nestjs/common';
import { PetMood } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RoomsService } from '../rooms/rooms.service';

@Injectable()
export class PetService {
  constructor(
    private prisma: PrismaService,
    private roomsService: RoomsService,
  ) {}

  async getOrCreatePet(roomId: string) {
    const pet = await this.prisma.pet.findUnique({ where: { roomId } });
    if (pet) return pet;
    return this.prisma.pet.create({
      data: { roomId, name: 'Buddy', mood: 'NEUTRAL', energy: 100 },
    });
  }

  async getPet(roomId: string, userId?: string) {
    if (userId) {
      await this.roomsService.ensureMembership(roomId, userId);
    }
    return this.getOrCreatePet(roomId);
  }

  async updateMood(roomId: string, mood: PetMood, userId?: string) {
    if (userId) {
      await this.roomsService.ensureMembership(roomId, userId);
    }
    await this.getOrCreatePet(roomId);
    return this.prisma.pet.update({ where: { roomId }, data: { mood } });
  }

  async feed(roomId: string, userId?: string) {
    if (userId) {
      await this.roomsService.ensureMembership(roomId, userId);
    }
    const pet = await this.getOrCreatePet(roomId);
    const energy = Math.min(100, pet.energy + 20);
    return this.prisma.pet.update({
      where: { roomId },
      data: { energy, mood: 'HAPPY' },
    });
  }
}
