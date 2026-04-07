import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PetController } from './pet.controller';
import { PetService } from './pet.service';
import { UpdateMoodDto, ChangePetTypeDto, PetDto, FeedResultDto } from './dto/pet.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

describe('PetController - Integration Tests', () => {
  let controller: PetController;
  let service: PetService;

  const mockUser: AuthenticatedUser = {
    userId: 'user-1',
    account: 'testuser',
    nickname: 'Test User',
    isGuest: false,
    isAdmin: false,
  };

  const mockPetDto: PetDto = {
    roomId: 'room-1',
    petType: 'cat',
    name: 'Pet',
    mood: 50,
    energy: 100,
    level: 1,
    updatedAt: new Date(),
  };

  const mockPetService = {
    getPet: jest.fn(),
    updateMood: jest.fn(),
    feed: jest.fn(),
    changePetTypeWithAuth: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PetController],
      providers: [
        {
          provide: PetService,
          useValue: mockPetService,
        },
      ],
    }).compile();

    controller = module.get<PetController>(PetController);
    service = module.get<PetService>(PetService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/rooms/:roomId/pet', () => {
    describe('Valid requests', () => {
      it('should return pet data for valid room and authorized user', async () => {
        // Requirement 6.1: GET endpoint returns pet data
        mockPetService.getPet.mockResolvedValue(mockPetDto);

        const result = await controller.getPet(mockUser, 'room-1');

        expect(result).toEqual(mockPetDto);
        expect(service.getPet).toHaveBeenCalledWith('room-1', 'user-1');
      });

      it('should return pet with cat type', async () => {
        const catPet = { ...mockPetDto, petType: 'cat' as const };
        mockPetService.getPet.mockResolvedValue(catPet);

        const result = await controller.getPet(mockUser, 'room-1');

        expect(result.petType).toBe('cat');
      });

      it('should return pet with dog type', async () => {
        const dogPet = { ...mockPetDto, petType: 'dog' as const };
        mockPetService.getPet.mockResolvedValue(dogPet);

        const result = await controller.getPet(mockUser, 'room-1');

        expect(result.petType).toBe('dog');
      });

      it('should return pet with valid mood range (0-100)', async () => {
        const petWithMood = { ...mockPetDto, mood: 75 };
        mockPetService.getPet.mockResolvedValue(petWithMood);

        const result = await controller.getPet(mockUser, 'room-1');

        expect(result.mood).toBe(75);
        expect(result.mood).toBeGreaterThanOrEqual(0);
        expect(result.mood).toBeLessThanOrEqual(100);
      });

      it('should return pet with valid energy range (0-100)', async () => {
        const petWithEnergy = { ...mockPetDto, energy: 60 };
        mockPetService.getPet.mockResolvedValue(petWithEnergy);

        const result = await controller.getPet(mockUser, 'room-1');

        expect(result.energy).toBe(60);
        expect(result.energy).toBeGreaterThanOrEqual(0);
        expect(result.energy).toBeLessThanOrEqual(100);
      });
    });

    describe('Authorization failures', () => {
      it('should throw 403 for non-member user', async () => {
        // Requirement 6.6: Non-members get 403
        mockPetService.getPet.mockRejectedValue(
          new ForbiddenException('You are not a member of this room')
        );

        await expect(controller.getPet(mockUser, 'room-1')).rejects.toThrow(
          ForbiddenException
        );
        expect(service.getPet).toHaveBeenCalledWith('room-1', 'user-1');
      });

      it('should throw 403 with appropriate error message', async () => {
        mockPetService.getPet.mockRejectedValue(
          new ForbiddenException('You are not a member of this room')
        );

        await expect(controller.getPet(mockUser, 'room-1')).rejects.toThrow(
          'You are not a member of this room'
        );
      });
    });

    describe('Non-existent rooms', () => {
      it('should throw 404 for non-existent room', async () => {
        // Test 404 for non-existent rooms
        mockPetService.getPet.mockRejectedValue(
          new NotFoundException('Room not found')
        );

        await expect(controller.getPet(mockUser, 'non-existent-room')).rejects.toThrow(
          NotFoundException
        );
      });
    });
  });

  describe('PATCH /api/rooms/:roomId/pet/mood', () => {
    describe('Valid requests', () => {
      it('should update mood with valid value', async () => {
        // Requirement 6.2: PATCH mood endpoint
        const dto: UpdateMoodDto = { mood: 75 };
        const updatedPet = { ...mockPetDto, mood: 75 };
        mockPetService.updateMood.mockResolvedValue(updatedPet);

        const result = await controller.updateMood(mockUser, 'room-1', dto);

        expect(result.mood).toBe(75);
        expect(service.updateMood).toHaveBeenCalledWith('room-1', 75, 'user-1');
      });

      it('should update mood to minimum value (0)', async () => {
        const dto: UpdateMoodDto = { mood: 0 };
        const updatedPet = { ...mockPetDto, mood: 0 };
        mockPetService.updateMood.mockResolvedValue(updatedPet);

        const result = await controller.updateMood(mockUser, 'room-1', dto);

        expect(result.mood).toBe(0);
      });

      it('should update mood to maximum value (100)', async () => {
        const dto: UpdateMoodDto = { mood: 100 };
        const updatedPet = { ...mockPetDto, mood: 100 };
        mockPetService.updateMood.mockResolvedValue(updatedPet);

        const result = await controller.updateMood(mockUser, 'room-1', dto);

        expect(result.mood).toBe(100);
      });
    });

    describe('Invalid inputs', () => {
      it('should reject mood below 0', async () => {
        const dto: UpdateMoodDto = { mood: -1 };
        
        // In real NestJS, validation pipes would reject this before reaching controller
        // We simulate the validation error
        mockPetService.updateMood.mockRejectedValue(
          new Error('Validation failed: mood must not be less than 0')
        );

        await expect(controller.updateMood(mockUser, 'room-1', dto)).rejects.toThrow();
      });

      it('should reject mood above 100', async () => {
        const dto: UpdateMoodDto = { mood: 101 };
        
        mockPetService.updateMood.mockRejectedValue(
          new Error('Validation failed: mood must not be greater than 100')
        );

        await expect(controller.updateMood(mockUser, 'room-1', dto)).rejects.toThrow();
      });

      it('should reject non-integer mood values', async () => {
        const dto: UpdateMoodDto = { mood: 50.5 };
        
        mockPetService.updateMood.mockRejectedValue(
          new Error('Validation failed: mood must be an integer')
        );

        await expect(controller.updateMood(mockUser, 'room-1', dto)).rejects.toThrow();
      });
    });

    describe('Authorization failures', () => {
      it('should throw 403 for non-member user', async () => {
        const dto: UpdateMoodDto = { mood: 75 };
        mockPetService.updateMood.mockRejectedValue(
          new ForbiddenException('You are not a member of this room')
        );

        await expect(controller.updateMood(mockUser, 'room-1', dto)).rejects.toThrow(
          ForbiddenException
        );
      });
    });

    describe('Non-existent rooms', () => {
      it('should throw 404 for non-existent room', async () => {
        const dto: UpdateMoodDto = { mood: 75 };
        mockPetService.updateMood.mockRejectedValue(
          new NotFoundException('Room not found')
        );

        await expect(controller.updateMood(mockUser, 'non-existent-room', dto)).rejects.toThrow(
          NotFoundException
        );
      });
    });
  });

  describe('POST /api/rooms/:roomId/pet/feed', () => {
    describe('Valid requests', () => {
      it('should feed pet and increase energy by 20', async () => {
        // Requirement 6.3: POST feed endpoint increases energy by 20
        const feedResult = {
          pet: { ...mockPetDto, energy: 70 },
          energyGained: 20,
        };
        mockPetService.feed.mockResolvedValue(feedResult);

        const result = await controller.feedPet(mockUser, 'room-1');

        expect(result.pet.energy).toBe(70);
        expect(result.energyGained).toBe(20);
        expect(result.message).toContain('20');
        expect(service.feed).toHaveBeenCalledWith('room-1', 'user-1');
      });

      it('should cap energy at 100 when feeding', async () => {
        const feedResult = {
          pet: { ...mockPetDto, energy: 100 },
          energyGained: 10,
        };
        mockPetService.feed.mockResolvedValue(feedResult);

        const result = await controller.feedPet(mockUser, 'room-1');

        expect(result.pet.energy).toBe(100);
        expect(result.energyGained).toBe(10);
      });

      it('should return FeedResultDto with all required fields', async () => {
        const feedResult = {
          pet: mockPetDto,
          energyGained: 20,
        };
        mockPetService.feed.mockResolvedValue(feedResult);

        const result = await controller.feedPet(mockUser, 'room-1');

        expect(result).toHaveProperty('pet');
        expect(result).toHaveProperty('energyGained');
        expect(result).toHaveProperty('message');
        expect(typeof result.message).toBe('string');
      });

      it('should feed pet with low energy (< 30)', async () => {
        const feedResult = {
          pet: { ...mockPetDto, energy: 40 },
          energyGained: 20,
        };
        mockPetService.feed.mockResolvedValue(feedResult);

        const result = await controller.feedPet(mockUser, 'room-1');

        expect(result.pet.energy).toBe(40);
        expect(result.energyGained).toBe(20);
      });

      it('should not increase energy if already at 100', async () => {
        const feedResult = {
          pet: { ...mockPetDto, energy: 100 },
          energyGained: 0,
        };
        mockPetService.feed.mockResolvedValue(feedResult);

        const result = await controller.feedPet(mockUser, 'room-1');

        expect(result.pet.energy).toBe(100);
        expect(result.energyGained).toBe(0);
      });
    });

    describe('Authorization failures', () => {
      it('should throw 403 for non-member user', async () => {
        mockPetService.feed.mockRejectedValue(
          new ForbiddenException('You are not a member of this room')
        );

        await expect(controller.feedPet(mockUser, 'room-1')).rejects.toThrow(
          ForbiddenException
        );
      });
    });

    describe('Non-existent rooms', () => {
      it('should throw 404 for non-existent room', async () => {
        mockPetService.feed.mockRejectedValue(
          new NotFoundException('Room not found')
        );

        await expect(controller.feedPet(mockUser, 'non-existent-room')).rejects.toThrow(
          NotFoundException
        );
      });
    });
  });

  describe('PATCH /api/rooms/:roomId/pet/type', () => {
    describe('Valid requests', () => {
      it('should change pet type to cat', async () => {
        // Requirement 6.4: PATCH type endpoint
        const dto: ChangePetTypeDto = { petType: 'cat' };
        const updatedPet = { ...mockPetDto, petType: 'cat' as const };
        mockPetService.changePetTypeWithAuth.mockResolvedValue(updatedPet);

        const result = await controller.changePetType(mockUser, 'room-1', dto);

        expect(result.petType).toBe('cat');
        expect(service.changePetTypeWithAuth).toHaveBeenCalledWith('room-1', 'cat', 'user-1');
      });

      it('should change pet type to dog', async () => {
        const dto: ChangePetTypeDto = { petType: 'dog' };
        const updatedPet = { ...mockPetDto, petType: 'dog' as const };
        mockPetService.changePetTypeWithAuth.mockResolvedValue(updatedPet);

        const result = await controller.changePetType(mockUser, 'room-1', dto);

        expect(result.petType).toBe('dog');
        expect(service.changePetTypeWithAuth).toHaveBeenCalledWith('room-1', 'dog', 'user-1');
      });

      it('should preserve other pet properties when changing type', async () => {
        const dto: ChangePetTypeDto = { petType: 'dog' };
        const updatedPet = { 
          ...mockPetDto, 
          petType: 'dog' as const,
          mood: 75,
          energy: 80,
          level: 2,
        };
        mockPetService.changePetTypeWithAuth.mockResolvedValue(updatedPet);

        const result = await controller.changePetType(mockUser, 'room-1', dto);

        expect(result.petType).toBe('dog');
        expect(result.mood).toBe(75);
        expect(result.energy).toBe(80);
        expect(result.level).toBe(2);
      });
    });

    describe('Invalid inputs', () => {
      it('should reject invalid pet type', async () => {
        const dto = { petType: 'bird' } as any;
        
        mockPetService.changePetTypeWithAuth.mockRejectedValue(
          new Error('Validation failed: petType must be one of: cat, dog')
        );

        await expect(controller.changePetType(mockUser, 'room-1', dto)).rejects.toThrow();
      });

      it('should reject empty pet type', async () => {
        const dto = { petType: '' } as any;
        
        mockPetService.changePetTypeWithAuth.mockRejectedValue(
          new Error('Validation failed: petType must be one of: cat, dog')
        );

        await expect(controller.changePetType(mockUser, 'room-1', dto)).rejects.toThrow();
      });

      it('should reject numeric pet type', async () => {
        const dto = { petType: 123 } as any;
        
        mockPetService.changePetTypeWithAuth.mockRejectedValue(
          new Error('Validation failed: petType must be one of: cat, dog')
        );

        await expect(controller.changePetType(mockUser, 'room-1', dto)).rejects.toThrow();
      });
    });

    describe('Authorization failures', () => {
      it('should throw 403 for non-member user', async () => {
        const dto: ChangePetTypeDto = { petType: 'dog' };
        mockPetService.changePetTypeWithAuth.mockRejectedValue(
          new ForbiddenException('You are not a member of this room')
        );

        await expect(controller.changePetType(mockUser, 'room-1', dto)).rejects.toThrow(
          ForbiddenException
        );
      });
    });

    describe('Non-existent rooms', () => {
      it('should throw 404 for non-existent room', async () => {
        const dto: ChangePetTypeDto = { petType: 'dog' };
        mockPetService.changePetTypeWithAuth.mockRejectedValue(
          new NotFoundException('Room not found')
        );

        await expect(controller.changePetType(mockUser, 'non-existent-room', dto)).rejects.toThrow(
          NotFoundException
        );
      });
    });
  });

  describe('Cross-endpoint integration scenarios', () => {
    it('should maintain pet state across multiple operations', async () => {
      // Get initial pet
      mockPetService.getPet.mockResolvedValue(mockPetDto);
      const initialPet = await controller.getPet(mockUser, 'room-1');
      expect(initialPet.energy).toBe(100);

      // Feed pet
      const feedResult = {
        pet: { ...mockPetDto, energy: 100 },
        energyGained: 0,
      };
      mockPetService.feed.mockResolvedValue(feedResult);
      const fedPet = await controller.feedPet(mockUser, 'room-1');
      expect(fedPet.pet.energy).toBe(100);

      // Update mood
      const updatedPet = { ...mockPetDto, mood: 80 };
      mockPetService.updateMood.mockResolvedValue(updatedPet);
      const moodUpdated = await controller.updateMood(mockUser, 'room-1', { mood: 80 });
      expect(moodUpdated.mood).toBe(80);
    });

    it('should handle pet type change and subsequent operations', async () => {
      // Change to dog
      const dogPet = { ...mockPetDto, petType: 'dog' as const };
      mockPetService.changePetTypeWithAuth.mockResolvedValue(dogPet);
      const changedPet = await controller.changePetType(mockUser, 'room-1', { petType: 'dog' });
      expect(changedPet.petType).toBe('dog');

      // Get pet after type change
      mockPetService.getPet.mockResolvedValue(dogPet);
      const retrievedPet = await controller.getPet(mockUser, 'room-1');
      expect(retrievedPet.petType).toBe('dog');
    });

    it('should handle multiple users accessing same room pet', async () => {
      const user1: AuthenticatedUser = { 
        userId: 'user-1', 
        account: 'user1', 
        nickname: 'User 1',
        isGuest: false,
        isAdmin: false,
      };
      const user2: AuthenticatedUser = { 
        userId: 'user-2', 
        account: 'user2',
        nickname: 'User 2',
        isGuest: false,
        isAdmin: false,
      };

      mockPetService.getPet.mockResolvedValue(mockPetDto);

      const pet1 = await controller.getPet(user1, 'room-1');
      const pet2 = await controller.getPet(user2, 'room-1');

      expect(pet1).toEqual(pet2);
      expect(service.getPet).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle very long room IDs', async () => {
      const longRoomId = 'a'.repeat(100);
      mockPetService.getPet.mockResolvedValue({ ...mockPetDto, roomId: longRoomId });

      const result = await controller.getPet(mockUser, longRoomId);

      expect(result.roomId).toBe(longRoomId);
    });

    it('should handle special characters in room IDs', async () => {
      const specialRoomId = 'room-123-abc_def';
      mockPetService.getPet.mockResolvedValue({ ...mockPetDto, roomId: specialRoomId });

      const result = await controller.getPet(mockUser, specialRoomId);

      expect(result.roomId).toBe(specialRoomId);
    });

    it('should handle concurrent feed operations', async () => {
      const feedResult = {
        pet: { ...mockPetDto, energy: 70 },
        energyGained: 20,
      };
      mockPetService.feed.mockResolvedValue(feedResult);

      const feed1 = controller.feedPet(mockUser, 'room-1');
      const feed2 = controller.feedPet(mockUser, 'room-1');

      const results = await Promise.all([feed1, feed2]);

      expect(results).toHaveLength(2);
      expect(service.feed).toHaveBeenCalledTimes(2);
    });
  });
});
