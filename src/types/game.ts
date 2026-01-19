export type PlayerRole = 'GK' | 'DF' | 'FW';
export type Team = 'blue' | 'red';
export type GamePhase = 
  | 'idle' 
  | 'kickoff_contest'       // Tranh chấp bóng giữa sân
  | 'df_buildup'           // Hậu vệ cầm bóng, đẩy lên hoặc chuyền ngang
  | 'df_passing'           // Hậu vệ đang chuyền cho tiền đạo
  | 'fw_attacking'         // Tiền đạo cầm bóng, tấn công
  | 'duel'                 // Va chạm giữa tiền đạo và hậu vệ
  | 'fw_breakthrough'      // Tiền đạo vượt qua hậu vệ
  | 'shooting'             // Tiền đạo sút bóng
  | 'goal_celebration'     // Hiển thị bảng điểm lớn sau khi ghi bàn
  | 'save'                 // Thủ môn cản phá
  | 'reset_to_center';     // Reset về giữa sân sau khi ghi bàn

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
  isInGoal?: boolean;
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
  showGoalOverlay?: boolean;
  lastScoringTeam?: Team;
  maxTurns: number;
  currentTurn: number;
  isMatchEnded?: boolean;
}

export interface LogEntry {
  id: string;
  time: number;
  message: string;
  type: 'info' | 'action' | 'goal' | 'skill' | 'duel' | 'pass';
}
