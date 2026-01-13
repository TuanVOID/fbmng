export type PlayerRole = 'GK' | 'DF' | 'FW';
export type Team = 'blue' | 'red';
export type GamePhase = 
  | 'idle' 
  | 'gk_has_ball'          // GK cầm bóng, chờ cầu thủ về vị trí
  | 'df_buildup'           // Hậu vệ cầm bóng, đẩy lên
  | 'df_passing'           // Hậu vệ đang chuyền cho tiền đạo
  | 'fw_attacking'         // Tiền đạo cầm bóng, tấn công
  | 'duel'                 // Va chạm giữa tiền đạo và hậu vệ
  | 'fw_breakthrough'      // Tiền đạo vượt qua hậu vệ
  | 'shooting'             // Tiền đạo sút bóng
  | 'goal'                 // Ghi bàn
  | 'save'                 // Thủ môn cản phá
  | 'reset';               // Reset về vị trí

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
  isDashing?: boolean;
}

export interface Skill {
  name: string;
  emoji: string;
  type: 'attack' | 'defense' | 'gk';
  effect: string;
}

export interface Ball {
  x: number;
  y: number;
  ownerId: string | null;
  isMoving?: boolean;
  targetX?: number;
  targetY?: number;
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
  attackingTeam: Team;
  phaseTimer: number;
}

export interface LogEntry {
  id: string;
  time: number;
  message: string;
  type: 'info' | 'action' | 'goal' | 'skill' | 'duel' | 'pass';
}
