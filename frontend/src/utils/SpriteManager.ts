import type { PetType, PetAnimationState } from '../types/pet';

const SPRITE_WIDTH = 128;
const SPRITE_HEIGHT = 128;
const FRAME_COUNT = 4;

const STATES: PetAnimationState[] = ['idle', 'happy', 'busy', 'hungry', 'reaction'];

export class SpriteManager {
  private cache = new Map<string, HTMLImageElement>();
  private loadingPromises = new Map<string, Promise<HTMLImageElement>>();

  constructor(public basePath = '/assets/pets') {}

  getSpritePath(petType: PetType, state: PetAnimationState): string {
    return `${this.basePath}/${petType}/${state}.png`;
  }

  async loadSprite(petType: PetType, state: PetAnimationState): Promise<HTMLImageElement> {
    const key = `${petType}-${state}`;
    
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key)!;
    }

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        this.cache.set(key, img);
        this.loadingPromises.delete(key);
        resolve(img);
      };
      
      img.onerror = (err) => {
        this.loadingPromises.delete(key);
        reject(err);
      };
      
      img.src = this.getSpritePath(petType, state);
    });

    this.loadingPromises.set(key, promise);
    return promise;
  }

  async preloadAllSprites(petType: PetType): Promise<void> {
    await Promise.allSettled(
      STATES.map(state => this.loadSprite(petType, state))
    );
  }

  drawFrame(
    ctx: CanvasRenderingContext2D,
    petType: PetType,
    state: PetAnimationState,
    frameIndex: number,
    x: number,
    y: number,
    scale: number = 1
  ): boolean {
    const key = `${petType}-${state}`;
    const img = this.cache.get(key);
    
    if (!img) {
      return false;
    }

    const frameWidth = SPRITE_WIDTH;
    const frameHeight = SPRITE_HEIGHT;
    const sx = (frameIndex % FRAME_COUNT) * frameWidth;
    const sy = 0;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      img,
      sx, sy, frameWidth, frameHeight,
      x, y, frameWidth * scale, frameHeight * scale
    );
    
    return true;
  }

  getPlaceholderEmoji(petType: PetType): string {
    return petType === 'cat' ? '😺' : '🐕';
  }

  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }
}
