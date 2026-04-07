import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { io, Socket } from 'socket.io-client';
import { PetGateway } from './pet.gateway';
import { PetService } from '../modules/pet/pet.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoomsService } from '../modules/rooms/rooms.service';

/**
 * Integration tests for PetGateway
 * Tests real Socket.IO connections and event handling
 */
describe('PetGateway Integration', () => {
  let app: NestFastifyApplication;
  let clientSocket: Socket;
  let gateway: PetGateway;

  // Helper function to get server port
  const getServerPort = (): number => {
    const server = app.getHttpServer();
    const address = server.address();
    return typeof address === 'string' ? 3000 : address.port;
  };

  // Helper function to create a new client
  const createClient = (): Socket => {
    const port = getServerPort();
    return io(`http://localhost:${port}/pet`, {
      transports: ['websocket'],
    });
  };

  // Mock services
  const mockPetService = {
    getPetByRoomId: jest.fn(),
    feedPet: jest.fn(),
    updateMood: jest.fn(),
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

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        PetGateway,
        {
          provide: PetService,
          useValue: mockPetService,
        },
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

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    gateway = moduleFixture.get<PetGateway>(PetGateway);
    
    await app.init();
    await app.listen(0); // Listen on random available port
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach((done) => {
    clientSocket = createClient();
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Connection', () => {
    it('should connect to /pet namespace', (done) => {
      expect(clientSocket.connected).toBe(true);
      done();
    });
  });

  describe('pet:join:room event', () => {
    it('should join room and receive acknowledgment', (done) => {
      clientSocket.emit('pet:join:room', { roomId: 'test-room-123' });

      clientSocket.on('pet:joined', (data) => {
        expect(data.roomId).toBe('test-room-123');
        expect(data.message).toBe('Successfully joined pet room');
        done();
      });
    });

    it('should emit error for missing roomId', (done) => {
      clientSocket.emit('pet:join:room', {});

      clientSocket.on('pet:error', (error) => {
        expect(error.code).toBe('MISSING_ROOM_ID');
        expect(error.message).toBe('Room ID is required');
        done();
      });
    });
  });

  describe('pet:state:change event', () => {
    it('should broadcast state change to room members', (done) => {
      const roomId = 'test-room-456';
      
      // Create second client to receive broadcast
      const client2 = createClient();

      client2.on('connect', () => {
        // Both clients join the same room
        clientSocket.emit('pet:join:room', { roomId });
        client2.emit('pet:join:room', { roomId });

        // Wait for both to join
        setTimeout(() => {
          // Client 2 listens for state change
          client2.on('pet:state:changed', (data) => {
            expect(data.roomId).toBe(roomId);
            expect(data.mood).toBe(80);
            expect(data.energy).toBe(90);
            expect(data.timestamp).toBeDefined();
            client2.disconnect();
            done();
          });

          // Client 1 emits state change
          clientSocket.emit('pet:state:change', {
            roomId,
            mood: 80,
            energy: 90,
            timestamp: Date.now(),
          });
        }, 100);
      });
    });

    it('should emit error for invalid state change data', (done) => {
      clientSocket.emit('pet:state:change', {
        mood: 80,
        // Missing roomId and energy
      });

      clientSocket.on('pet:error', (error) => {
        expect(error.code).toBe('INVALID_PAYLOAD');
        expect(error.message).toBe('Invalid state change data');
        done();
      });
    });

    it('should emit error when roomId is missing', (done) => {
      clientSocket.emit('pet:state:change', {
        mood: 50,
        energy: 60,
        timestamp: Date.now(),
      });

      clientSocket.on('pet:error', (error) => {
        expect(error.code).toBe('INVALID_PAYLOAD');
        expect(error.message).toBe('Invalid state change data');
        done();
      });
    });

    it('should emit error when mood is missing', (done) => {
      clientSocket.emit('pet:state:change', {
        roomId: 'test-room',
        energy: 60,
        timestamp: Date.now(),
      });

      clientSocket.on('pet:error', (error) => {
        expect(error.code).toBe('INVALID_PAYLOAD');
        expect(error.message).toBe('Invalid state change data');
        done();
      });
    });

    it('should emit error when energy is missing', (done) => {
      clientSocket.emit('pet:state:change', {
        roomId: 'test-room',
        mood: 50,
        timestamp: Date.now(),
      });

      clientSocket.on('pet:error', (error) => {
        expect(error.code).toBe('INVALID_PAYLOAD');
        expect(error.message).toBe('Invalid state change data');
        done();
      });
    });

    it('should accept valid state change with all required fields', (done) => {
      const roomId = 'test-room-valid';
      
      clientSocket.emit('pet:join:room', { roomId });

      clientSocket.on('pet:joined', () => {
        clientSocket.on('pet:state:changed', (data) => {
          expect(data.roomId).toBe(roomId);
          expect(data.mood).toBe(75);
          expect(data.energy).toBe(85);
          expect(data.timestamp).toBeDefined();
          expect(typeof data.timestamp).toBe('number');
          done();
        });

        clientSocket.emit('pet:state:change', {
          roomId,
          mood: 75,
          energy: 85,
          timestamp: Date.now(),
        });
      });
    });

    it('should add timestamp if not provided in payload', (done) => {
      const roomId = 'test-room-timestamp';
      
      clientSocket.emit('pet:join:room', { roomId });

      clientSocket.on('pet:joined', () => {
        clientSocket.on('pet:state:changed', (data) => {
          expect(data.roomId).toBe(roomId);
          expect(data.timestamp).toBeDefined();
          expect(typeof data.timestamp).toBe('number');
          expect(data.timestamp).toBeGreaterThan(0);
          done();
        });

        clientSocket.emit('pet:state:change', {
          roomId,
          mood: 50,
          energy: 50,
        });
      });
    });
  });

  describe('pet:leave:room event', () => {
    it('should leave room successfully', (done) => {
      const roomId = 'test-room-789';

      clientSocket.emit('pet:join:room', { roomId });

      clientSocket.on('pet:joined', () => {
        clientSocket.emit('pet:leave:room', { roomId });
        
        // Wait a bit to ensure leave is processed
        setTimeout(() => {
          // If we got here without errors, leave was successful
          done();
        }, 50);
      });
    });
  });

  describe('Room isolation', () => {
    it('should only broadcast to clients in the same room', (done) => {
      const room1 = 'room-1';
      const room2 = 'room-2';
      
      const client2 = createClient();

      let client2ReceivedEvent = false;

      client2.on('connect', () => {
        // Client 1 joins room 1
        clientSocket.emit('pet:join:room', { roomId: room1 });
        
        // Client 2 joins room 2
        client2.emit('pet:join:room', { roomId: room2 });

        setTimeout(() => {
          // Client 2 should NOT receive this event
          client2.on('pet:state:changed', () => {
            client2ReceivedEvent = true;
          });

          // Client 1 emits to room 1
          clientSocket.emit('pet:state:change', {
            roomId: room1,
            mood: 50,
            energy: 60,
            timestamp: Date.now(),
          });

          // Wait and verify client 2 didn't receive it
          setTimeout(() => {
            expect(client2ReceivedEvent).toBe(false);
            client2.disconnect();
            done();
          }, 100);
        }, 100);
      });
    });

    it('should broadcast to multiple clients in the same room', (done) => {
      const roomId = 'multi-client-room';
      
      const client2 = createClient();
      const client3 = createClient();

      let client2Received = false;
      let client3Received = false;

      const checkCompletion = () => {
        if (client2Received && client3Received) {
          client2.disconnect();
          client3.disconnect();
          done();
        }
      };

      Promise.all([
        new Promise<void>((resolve) => client2.on('connect', () => resolve())),
        new Promise<void>((resolve) => client3.on('connect', () => resolve())),
      ]).then(() => {
        // All three clients join the same room
        clientSocket.emit('pet:join:room', { roomId });
        client2.emit('pet:join:room', { roomId });
        client3.emit('pet:join:room', { roomId });

        setTimeout(() => {
          client2.on('pet:state:changed', (data) => {
            expect(data.roomId).toBe(roomId);
            expect(data.mood).toBe(70);
            client2Received = true;
            checkCompletion();
          });

          client3.on('pet:state:changed', (data) => {
            expect(data.roomId).toBe(roomId);
            expect(data.mood).toBe(70);
            client3Received = true;
            checkCompletion();
          });

          // Client 1 emits state change
          clientSocket.emit('pet:state:change', {
            roomId,
            mood: 70,
            energy: 80,
            timestamp: Date.now(),
          });
        }, 150);
      });
    });

    it('should not receive events after leaving room', (done) => {
      const roomId = 'leave-test-room';
      
      const client2 = createClient();

      let client2ReceivedEvent = false;

      client2.on('connect', () => {
        // Client 2 joins room
        client2.emit('pet:join:room', { roomId });

        client2.on('pet:joined', () => {
          // Client 2 leaves room
          client2.emit('pet:leave:room', { roomId });

          setTimeout(() => {
            // Client 2 should NOT receive this event after leaving
            client2.on('pet:state:changed', () => {
              client2ReceivedEvent = true;
            });

            // Client 1 joins and emits
            clientSocket.emit('pet:join:room', { roomId });
            
            setTimeout(() => {
              clientSocket.emit('pet:state:change', {
                roomId,
                mood: 60,
                energy: 70,
                timestamp: Date.now(),
              });

              // Wait and verify client 2 didn't receive it
              setTimeout(() => {
                expect(client2ReceivedEvent).toBe(false);
                client2.disconnect();
                done();
              }, 100);
            }, 50);
          }, 50);
        });
      });
    });

    it('should filter events by roomId in payload', (done) => {
      const room1 = 'filter-room-1';
      const room2 = 'filter-room-2';
      
      const client2 = createClient();

      let receivedEvents: any[] = [];

      client2.on('connect', () => {
        // Client 1 joins room 1
        clientSocket.emit('pet:join:room', { roomId: room1 });
        
        // Client 2 joins room 2
        client2.emit('pet:join:room', { roomId: room2 });

        setTimeout(() => {
          // Client 2 listens for events
          client2.on('pet:state:changed', (data) => {
            receivedEvents.push(data);
          });

          // Client 1 emits to room 1 (client 2 should NOT receive)
          clientSocket.emit('pet:state:change', {
            roomId: room1,
            mood: 50,
            energy: 60,
            timestamp: Date.now(),
          });

          // Wait and verify client 2 only received events for room 2
          setTimeout(() => {
            // Client 2 should not have received any events
            expect(receivedEvents.length).toBe(0);
            
            // Now emit to room 2
            client2.emit('pet:state:change', {
              roomId: room2,
              mood: 80,
              energy: 90,
              timestamp: Date.now(),
            });

            setTimeout(() => {
              // Client 2 should have received its own room's event
              expect(receivedEvents.length).toBe(1);
              expect(receivedEvents[0].roomId).toBe(room2);
              client2.disconnect();
              done();
            }, 100);
          }, 100);
        }, 100);
      });
    });
  });

  describe('Event payload validation (Requirements 8.3, 8.4)', () => {
    it('should validate that all required fields are present in broadcast', (done) => {
      const roomId = 'validation-room';
      
      clientSocket.emit('pet:join:room', { roomId });

      clientSocket.on('pet:joined', () => {
        clientSocket.on('pet:state:changed', (data) => {
          // Validate all required fields are present
          expect(data).toHaveProperty('roomId');
          expect(data).toHaveProperty('mood');
          expect(data).toHaveProperty('energy');
          expect(data).toHaveProperty('timestamp');
          
          // Validate field types
          expect(typeof data.roomId).toBe('string');
          expect(typeof data.mood).toBe('number');
          expect(typeof data.energy).toBe('number');
          expect(typeof data.timestamp).toBe('number');
          
          done();
        });

        clientSocket.emit('pet:state:change', {
          roomId,
          mood: 65,
          energy: 75,
          timestamp: Date.now(),
        });
      });
    });

    it('should validate roomId matches current room', (done) => {
      const correctRoom = 'correct-room';
      const wrongRoom = 'wrong-room';
      
      const client2 = createClient();

      let receivedWrongRoomEvent = false;

      client2.on('connect', () => {
        // Client 2 joins correct room
        client2.emit('pet:join:room', { roomId: correctRoom });

        client2.on('pet:joined', () => {
          // Listen for events
          client2.on('pet:state:changed', (data) => {
            if (data.roomId === wrongRoom) {
              receivedWrongRoomEvent = true;
            }
          });

          // Client 1 joins wrong room and emits
          clientSocket.emit('pet:join:room', { roomId: wrongRoom });
          
          setTimeout(() => {
            clientSocket.emit('pet:state:change', {
              roomId: wrongRoom,
              mood: 50,
              energy: 60,
              timestamp: Date.now(),
            });

            // Wait and verify client 2 didn't receive wrong room event
            setTimeout(() => {
              expect(receivedWrongRoomEvent).toBe(false);
              client2.disconnect();
              done();
            }, 100);
          }, 50);
        });
      });
    });

    it('should handle numeric values for mood and energy', (done) => {
      const roomId = 'numeric-validation-room';
      
      clientSocket.emit('pet:join:room', { roomId });

      clientSocket.on('pet:joined', () => {
        clientSocket.on('pet:state:changed', (data) => {
          expect(data.mood).toBe(0);
          expect(data.energy).toBe(100);
          expect(typeof data.mood).toBe('number');
          expect(typeof data.energy).toBe('number');
          done();
        });

        clientSocket.emit('pet:state:change', {
          roomId,
          mood: 0,
          energy: 100,
          timestamp: Date.now(),
        });
      });
    });
  });
});
