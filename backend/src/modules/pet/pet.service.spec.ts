import { Test, TestingModule } from '@nestjs/testing';
import { PetService } from './pet.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
import { Pet } from '@prisma/client';

describe('PetService', () => {
  let service: PetService;
  let prisma: PrismaService;
  let roomsService: RoomsService;

  const mockPet: Pet = {
    id: 'pet-1',
    roomId: 'room-1',
    petType: 'cat',
    name: 'Pet',
    mood: 50,
    energy: 100,
    level: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    pet: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockRoomsService = {
    ensureMembership: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RoomsService,
          useValue: mockRoomsService,
        },
      ],
    }).compile();

    service = module.get<PetService>(PetService);
    prisma = module.get<PrismaService>(PrismaService);
    roomsService = module.get<RoomsService>(RoomsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPetByRoomId', () => {
    it('should return existing pet', async () => {
      mockPrismaService.pet.findUnique.mockResolvedValue(mockPet);

      const result = await service.getPetByRoomId('room-1');

      expect(result).toEqual(mockPet);
      expect(prisma.pet.findUnique).toHaveBeenCalledWith({
        where: { roomId: 'room-1' },
      });
    });

    it('should create default pet if not exists', async () => {
      mockPrismaService.pet.findUnique.mockResolvedValue(null);
      mockPrismaService.pet.create.mockResolvedValue(mockPet);

      const result = await service.getPetByRoomId('room-1');

      expect(result).toEqual(mockPet);
      expect(prisma.pet.create).toHaveBeenCalledWith({
        data: {
          roomId: 'room-1',
          petType: 'cat',
          name: 'Pet',
          mood: 50,
          energy: 100,
          level: 1,
        },
      });
    });
  });

  describe('updateMood', () => {
    it('should update pet mood', async () => {
      const updatedPet = { ...mockPet, mood: 75 };
      mockPrismaService.pet.findUnique.mockResolvedValue(mockPet);
      mockPrismaService.pet.update.mockResolvedValue(updatedPet);
      mockRoomsService.ensureMembership.mockResolvedValue(undefined);

      const result = await service.updateMood('room-1', 75, 'user-1');

      expect(result.mood).toBe(75);
      expect(roomsService.ensureMembership).toHaveBeenCalledWith('room-1', 'user-1');
      expect(prisma.pet.update).toHaveBeenCalledWith({
        where: { roomId: 'room-1' },
        data: { mood: 75 },
      });
    });

    it('should create pet if not exists before updating', async () => {
      mockPrismaService.pet.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.pet.create.mockResolvedValue(mockPet);
      mockPrismaService.pet.update.mockResolvedValue({ ...mockPet, mood: 75 });
      mockRoomsService.ensureMembership.mockResolvedValue(undefined);

      await service.updateMood('room-1', 75, 'user-1');

      expect(prisma.pet.create).toHaveBeenCalled();
    });
  });

  describe('feedPet', () => {
    it('should increase energy by 20', async () => {
      const petWithLowEnergy = { ...mockPet, energy: 50 };
      const updatedPet = { ...mockPet, energy: 70 };
      mockPrismaService.pet.findUnique.mockResolvedValue(petWithLowEnergy);
      mockPrismaService.pet.update.mockResolvedValue(updatedPet);

      const result = await service.feedPet('room-1');

      expect(result.pet).toEqual(updatedPet);
      expect(result.energyGained).toBe(20);
      expect(prisma.pet.update).toHaveBeenCalledWith({
        where: { roomId: 'room-1' },
        data: { energy: 70 },
      });
    });

    it('should cap energy at 100', async () => {
      const petWithHighEnergy = { ...mockPet, energy: 90 };
      const updatedPet = { ...mockPet, energy: 100 };
      mockPrismaService.pet.findUnique.mockResolvedValue(petWithHighEnergy);
      mockPrismaService.pet.update.mockResolvedValue(updatedPet);

      const result = await service.feedPet('room-1');

      expect(result.pet.energy).toBe(100);
      expect(result.energyGained).toBe(10);
      expect(prisma.pet.update).toHaveBeenCalledWith({
        where: { roomId: 'room-1' },
        data: { energy: 100 },
      });
    });

    it('should not increase energy if already at 100', async () => {
      const petWithFullEnergy = { ...mockPet, energy: 100 };
      mockPrismaService.pet.findUnique.mockResolvedValue(petWithFullEnergy);
      mockPrismaService.pet.update.mockResolvedValue(petWithFullEnergy);

      const result = await service.feedPet('room-1');

      expect(result.pet.energy).toBe(100);
      expect(result.energyGained).toBe(0);
    });
  });

  describe('changePetType', () => {
    it('should change pet type to dog', async () => {
      const updatedPet = { ...mockPet, petType: 'dog' };
      mockPrismaService.pet.findUnique.mockResolvedValue(mockPet);
      mockPrismaService.pet.update.mockResolvedValue(updatedPet);

      const result = await service.changePetType('room-1', 'dog');

      expect(result).toEqual(updatedPet);
      expect(prisma.pet.update).toHaveBeenCalledWith({
        where: { roomId: 'room-1' },
        data: { petType: 'dog' },
      });
    });

    it('should create pet if not exists before changing type', async () => {
      mockPrismaService.pet.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.pet.create.mockResolvedValue(mockPet);
      mockPrismaService.pet.update.mockResolvedValue({ ...mockPet, petType: 'dog' });

      await service.changePetType('room-1', 'dog');

      expect(prisma.pet.create).toHaveBeenCalled();
    });
  });

  describe('createDefaultPet', () => {
    it('should create pet with default values', async () => {
      mockPrismaService.pet.create.mockResolvedValue(mockPet);

      const result = await service.createDefaultPet('room-1');

      expect(result).toEqual(mockPet);
      expect(prisma.pet.create).toHaveBeenCalledWith({
        data: {
          roomId: 'room-1',
          petType: 'cat',
          name: 'Pet',
          mood: 50,
          energy: 100,
          level: 1,
        },
      });
    });
  });
});
