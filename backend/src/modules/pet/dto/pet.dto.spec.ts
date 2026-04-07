import { validate } from 'class-validator';
import { UpdateMoodDto, ChangePetTypeDto, StateChangeDto, PetDto, FeedResultDto } from './pet.dto';

describe('Pet DTOs', () => {
  describe('UpdateMoodDto', () => {
    it('should validate correct mood value', async () => {
      const dto = new UpdateMoodDto();
      dto.mood = 50;
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject mood below 0', async () => {
      const dto = new UpdateMoodDto();
      dto.mood = -1;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject mood above 100', async () => {
      const dto = new UpdateMoodDto();
      dto.mood = 101;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-integer mood', async () => {
      const dto = new UpdateMoodDto();
      dto.mood = 50.5;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('ChangePetTypeDto', () => {
    it('should validate cat type', async () => {
      const dto = new ChangePetTypeDto();
      dto.petType = 'cat';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate dog type', async () => {
      const dto = new ChangePetTypeDto();
      dto.petType = 'dog';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid pet type', async () => {
      const dto = new ChangePetTypeDto();
      (dto as any).petType = 'bird';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('StateChangeDto', () => {
    it('should validate correct state change data', async () => {
      const dto = new StateChangeDto();
      dto.roomId = 'room123';
      dto.mood = 75;
      dto.energy = 80;
      dto.timestamp = Date.now();
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid mood value', async () => {
      const dto = new StateChangeDto();
      dto.roomId = 'room123';
      dto.mood = 150;
      dto.energy = 80;
      dto.timestamp = Date.now();
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid energy value', async () => {
      const dto = new StateChangeDto();
      dto.roomId = 'room123';
      dto.mood = 75;
      dto.energy = -10;
      dto.timestamp = Date.now();
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('PetDto', () => {
    it('should validate correct pet data', async () => {
      const dto = new PetDto();
      dto.roomId = 'room123';
      dto.petType = 'cat';
      dto.name = 'Fluffy';
      dto.mood = 50;
      dto.energy = 100;
      dto.level = 1;
      dto.updatedAt = new Date();
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('FeedResultDto', () => {
    it('should validate correct feed result', async () => {
      const petDto = new PetDto();
      petDto.roomId = 'room123';
      petDto.petType = 'cat';
      petDto.name = 'Fluffy';
      petDto.mood = 50;
      petDto.energy = 100;
      petDto.level = 1;
      petDto.updatedAt = new Date();

      const dto = new FeedResultDto();
      dto.pet = petDto;
      dto.energyGained = 20;
      dto.message = 'Pet fed successfully';
      
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
