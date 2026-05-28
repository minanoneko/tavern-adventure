import type { ActionOption } from '../types';

export interface AuthoredEvent {
  id: string;
  title: string;
  sceneText: string;
  actionOptions: ActionOption[];
  aiInstruction: string;
}

/** Reserved for manual_options / hybrid mode. Empty in v1. */
export const authoredEvents: AuthoredEvent[] = [];
