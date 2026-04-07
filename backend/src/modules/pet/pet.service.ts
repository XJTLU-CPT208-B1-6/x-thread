import { Injectable } from '@nestjs/common';
import { Pet } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
import { PetDto } from './dto/pet.dto';

@Injectable()
export class PetService {
  constructor(
    private prisma: PrismaService,
    private roomsService: RoomsService,
  ) {}

  /**
   * Map Prisma Pet to PetDto
   */
  private mapToPetDto(pet: Pet): PetDto {
    return {
      roomId: pet.roomId,
      petType: pet.petType as 'cat' | 'dog',
      name: pet.name,
      mood: pet.mood,
      energy: pet.energy,
      level: pet.level,
      updatedAt: pet.updatedAt,
    };
  }

  /**
   * Get pet by room ID
   * Requirement 6.1: GET /api/rooms/:roomId/pet endpoint
   */
  async getPetByRoomId(roomId: string): Promise<Pet> {
    const pet = await this.prisma.pet.findUnique({ where: { roomId } });
    if (!pet) {
      // Create default pet if not exists
      return this.createDefaultPet(roomId);
    }
    return pet;
  }

  /**
   * Update pet mood (internal method)
   * Requirement 6.2: PATCH /api/rooms/:roomId/pet/mood endpoint
   */
  private async updateMoodInternal(roomId: string, mood: number): Promise<Pet> {
    // Ensure pet exists
    await this.getPetByRoomId(roomId);
    
    // Update mood (0-100)
    return this.prisma.pet.update({
      where: { roomId },
      data: { mood },
    });
  }

  /**
   * Feed pet - increases energy by 20, capped at 100
   * Requirement 6.3: POST /api/rooms/:roomId/pet/feed endpoint
   */
  async feedPet(roomId: string): Promise<{ pet: Pet; energyGained: number }> {
    const pet = await this.getPetByRoomId(roomId);
    
    // Calculate new energy: add 20, cap at 100
    const newEnergy = Math.min(pet.energy + 20, 100);
    const energyGained = newEnergy - pet.energy;
    
    // Update pet with new energy
    const updatedPet = await this.prisma.pet.update({
      where: { roomId },
      data: { energy: newEnergy },
    });
    
    return { pet: updatedPet, energyGained };
  }

  /**
   * Change pet type
   * Requirement 6.4: PATCH /api/rooms/:roomId/pet/type endpoint
   */
  async changePetType(roomId: string, petType: string): Promise<Pet> {
    // Ensure pet exists
    await this.getPetByRoomId(roomId);
    
    // Update pet type
    return this.prisma.pet.update({
      where: { roomId },
      data: { petType },
    });
  }

  /**
   * Create default pet for a room
   * Requirement 2.5: Default pet creation
   */
  async createDefaultPet(roomId: string): Promise<Pet> {
    return this.prisma.pet.create({
      data: {
        roomId,
        petType: 'cat', // Default to cat
        name: 'Pet',
        mood: 50,
        energy: 100,
        level: 1,
      },
    });
  }

  /**
   * Calculate hunger state based on energy
   * Requirement 2.5: Energy < 30 triggers Hungry state
   */
  private calculateHungerState(energy: number): boolean {
    return energy < 30;
  }

  /**
   * Get pet with room membership verification
   * Requirement 6.1, 6.6: GET /api/rooms/:roomId/pet with authorization
   */
  async getPet(roomId: string, userId: string): Promise<PetDto> {
    await this.roomsService.ensureMembership(roomId, userId);
    const pet = await this.getPetByRoomId(roomId);
    return this.mapToPetDto(pet);
  }

  /**
   * Update mood with room membership verification
   * Requirement 6.2, 6.6: PATCH /api/rooms/:roomId/pet/mood with authorization
   */
  async updateMood(roomId: string, mood: number, userId: string): Promise<PetDto> {
    await this.roomsService.ensureMembership(roomId, userId);
    const pet = await this.updateMoodInternal(roomId, mood);
    return this.mapToPetDto(pet);
  }

  /**
   * Feed pet with room membership verification
   * Requirement 6.3, 6.6: POST /api/rooms/:roomId/pet/feed with authorization
   */
  async feed(roomId: string, userId: string): Promise<{ pet: PetDto; energyGained: number }> {
    await this.roomsService.ensureMembership(roomId, userId);
    const result = await this.feedPet(roomId);
    return {
      pet: this.mapToPetDto(result.pet),
      energyGained: result.energyGained,
    };
  }

  /**
   * Change pet type with room membership verification
   * Requirement 6.4, 6.6: PATCH /api/rooms/:roomId/pet/type with authorization
   */
  async changePetTypeWithAuth(roomId: string, petType: string, userId: string): Promise<PetDto> {
    await this.roomsService.ensureMembership(roomId, userId);
    const pet = await this.changePetType(roomId, petType);
    return this.mapToPetDto(pet);
  }
}
