# Pet DTOs

This directory contains Data Transfer Objects (DTOs) for the Pet API module.

## DTOs

### Response DTOs

#### PetDto
Represents the complete pet data returned by the API.

**Fields:**
- `roomId` (string): The room ID this pet belongs to
- `petType` ('cat' | 'dog'): The type of pet
- `name` (string): The pet's name
- `mood` (number): Pet's mood value (0-100)
- `energy` (number): Pet's energy value (0-100)
- `level` (number): Pet's level (minimum 1)
- `updatedAt` (Date): Last update timestamp

#### FeedResultDto
Represents the result of a feed operation.

**Fields:**
- `pet` (PetDto): The updated pet data
- `energyGained` (number): Amount of energy gained (minimum 0)
- `message` (string): Success message

### Request DTOs

#### UpdateMoodDto
Used to update the pet's mood.

**Fields:**
- `mood` (number): New mood value (0-100, must be integer)

**Validation:**
- Must be an integer
- Must be between 0 and 100

#### ChangePetTypeDto
Used to change the pet type.

**Fields:**
- `petType` ('cat' | 'dog'): New pet type

**Validation:**
- Must be either 'cat' or 'dog'

### Socket.IO DTOs

#### StateChangeDto
Used for real-time state synchronization via Socket.IO.

**Fields:**
- `roomId` (string): The room ID
- `mood` (number): Current mood value (0-100)
- `energy` (number): Current energy value (0-100)
- `timestamp` (number): Event timestamp

**Validation:**
- `mood` and `energy` must be integers between 0 and 100
- `timestamp` must be a number

## Usage

```typescript
import { PetDto, UpdateMoodDto, ChangePetTypeDto, FeedResultDto, StateChangeDto } from './dto';

// In controller
@Patch('mood')
updateMood(@Body() dto: UpdateMoodDto) {
  // dto.mood is validated automatically
}

// In service
async getPet(roomId: string): Promise<PetDto> {
  // Return pet data
}
```

## Validation

All DTOs use `class-validator` decorators for automatic validation:
- `@IsInt()`: Ensures the value is an integer
- `@Min(n)`: Ensures the value is at least n
- `@Max(n)`: Ensures the value is at most n
- `@IsIn([...])`: Ensures the value is one of the allowed values
- `@IsString()`: Ensures the value is a string
- `@IsDate()`: Ensures the value is a Date object
- `@IsNumber()`: Ensures the value is a number

## Requirements

This implementation satisfies requirements 6.1, 6.2, 6.3, and 6.4 from the ai-pet-integration spec.
