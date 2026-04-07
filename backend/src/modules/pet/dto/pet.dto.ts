import { IsInt, Min, Max, IsIn, IsString, IsDate, IsNumber } from 'class-validator';

// Response DTOs
export class PetDto {
  @IsString()
  roomId: string;

  @IsIn(['cat', 'dog'])
  petType: 'cat' | 'dog';

  @IsString()
  name: string;

  @IsInt()
  @Min(0)
  @Max(100)
  mood: number;

  @IsInt()
  @Min(0)
  @Max(100)
  energy: number;

  @IsInt()
  @Min(1)
  level: number;

  @IsDate()
  updatedAt: Date;
}

export class FeedResultDto {
  pet: PetDto;

  @IsInt()
  @Min(0)
  energyGained: number;

  @IsString()
  message: string;
}

// Request DTOs
export class UpdateMoodDto {
  @IsInt()
  @Min(0)
  @Max(100)
  mood: number;
}

export class ChangePetTypeDto {
  @IsIn(['cat', 'dog'])
  petType: 'cat' | 'dog';
}

// Socket.IO DTOs
export class StateChangeDto {
  @IsString()
  roomId: string;

  @IsInt()
  @Min(0)
  @Max(100)
  mood: number;

  @IsInt()
  @Min(0)
  @Max(100)
  energy: number;

  @IsNumber()
  timestamp: number;
}
