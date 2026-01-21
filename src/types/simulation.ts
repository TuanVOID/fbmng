export type SimEventType = 
  | 'startMatch' 
  | 'endMatch' 
  | 'startHalf' 
  | 'endHalf' 
  | 'startTurn' 
  | 'endTurn'
  | 'wonKickoff'
  | 'passBall'
  | 'lostBall'
  | 'shotGoal'
  | 'shotFailed'
  | 'fwDfDuelSuccess'
  | 'fwDfDuelFailed'
  | 'decrementStamina'
  | 'incrementRage';

export interface SimEvent {
  type: SimEventType;
  params: string[];
  raw: string;
}

export interface SimPlayer {
  id: string; // e.g. "T1-D4", "T2-F1", "T1-G"
  team: 'T1' | 'T2';
  role: 'G' | 'D' | 'F';
  index: number;
  stamina: number;
  maxStamina: number;
  rage: number;
  maxRage: number;
  hasBall: boolean;
  x: number;
  y: number;
}

export interface SimMatchState {
  formation: { t1: string; t2: string };
  half: number;
  turn: number;
  score: { t1: number; t2: number };
  players: SimPlayer[];
  ballOwnerId: string | null;
  isEnded: boolean;
}

export interface ParsedMatch {
  formation: { t1: string; t2: string };
  events: SimEvent[];
}
