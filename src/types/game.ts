export type PlayerRole = 'GK' | 'DF' | 'FW';
export type Team = 'blue' | 'red';
export type GamePhase = 'idle' | 'kickoff' | 'buildup' | 'confrontation' | 'finishing' | 'goal' | 'reset';

export interface PlayerStats {
  atk: number;
  def: number;
  spd: number;
}

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  team: Team;
  stats: PlayerStats;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  rage: number;
  maxRage: number;
  hasBall: boolean;
  skill: Skill;
  isSkillActive: boolean;
}

export interface Skill {
  name: string;
  emoji: string;
  type: 'attack' | 'defense';
  effect: string;
}

export interface Ball {
  x: number;
  y: number;
  ownerId: string | null;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  ball: Ball;
  score: { blue: number; red: number };
  matchLog: LogEntry[];
  selectedPlayerId: string | null;
  isRunning: boolean;
  matchTime: number;
}

export interface LogEntry {
  id: string;
  time: number;
  message: string;
  type: 'info' | 'action' | 'goal' | 'skill' | 'duel';
}
