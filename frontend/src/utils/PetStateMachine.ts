import type { PetAnimationState, StateTransition } from '../types/pet';

export class PetStateMachine {
  currentState: PetAnimationState = 'idle';
  previousState: PetAnimationState = 'idle';
  private stateTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private onStateChangeCallback?: (state: PetAnimationState) => void;

  constructor(onStateChange?: (state: PetAnimationState) => void) {
    this.onStateChangeCallback = onStateChange;
  }

  setOnStateChange(callback: (state: PetAnimationState) => void): void {
    this.onStateChangeCallback = callback;
  }

  transition({ state, duration }: StateTransition): void {
    this.clearAllTimers();
    
    this.previousState = this.currentState;
    this.currentState = state;
    
    this.onStateChangeCallback?.(state);

    if (duration && duration > 0) {
      const timerId = setTimeout(() => {
        this.transition({ state: this.previousState });
      }, duration);
      this.stateTimers.set('transition', timerId);
    }
  }

  playReaction(): void {
    const previous = this.currentState;
    this.transition({ state: 'reaction', duration: 400 });
  }

  getCurrentState(): PetAnimationState {
    return this.currentState;
  }

  getPreviousState(): PetAnimationState {
    return this.previousState;
  }

  reset(): void {
    this.clearAllTimers();
    this.previousState = 'idle';
    this.currentState = 'idle';
  }

  private clearAllTimers(): void {
    this.stateTimers.forEach(timer => clearTimeout(timer));
    this.stateTimers.clear();
  }

  destroy(): void {
    this.clearAllTimers();
  }
}
