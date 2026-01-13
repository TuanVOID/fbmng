import { Player, PlayerRole, Team, Ball, Skill } from '@/types/game';
import { petNames, attackSkills, defenseSkills, gkSkills } from '@/data/petNames';

const PITCH_WIDTH = 400;
const PITCH_HEIGHT = 600;

export const randomStat = () => Math.floor(Math.random() * 60) + 40;

export const getRandomName = (usedNames: string[]): string => {
  const available = petNames.filter(n => !usedNames.includes(n));
  return available[Math.floor(Math.random() * available.length)] || `Pet${Math.random().toString(36).slice(2, 5)}`;
};

export const getSkillForRole = (role: PlayerRole): Skill => {
  if (role === 'GK') return gkSkills[Math.floor(Math.random() * gkSkills.length)];
  if (role === 'FW') return attackSkills[Math.floor(Math.random() * attackSkills.length)];
  return defenseSkills[Math.floor(Math.random() * defenseSkills.length)];
};

export const createPlayer = (
  id: string,
  role: PlayerRole,
  team: Team,
  x: number,
  y: number,
  usedNames: string[]
): Player => {
  const name = getRandomName(usedNames);
  return {
    id,
    name,
    role,
    team,
    stats: {
      atk: randomStat(),
      def: randomStat(),
      spd: randomStat(),
    },
    x,
    y,
    baseX: x,
    baseY: y,
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    rage: 0,
    maxRage: 100,
    hasBall: false,
    skill: getSkillForRole(role),
    isSkillActive: false,
  };
};

export const createTeam = (team: Team): Player[] => {
  const usedNames: string[] = [];
  const players: Player[] = [];
  const isBlue = team === 'blue';
  
  // Positions relative to pitch (blue at bottom, red at top)
  const gkY = isBlue ? PITCH_HEIGHT - 50 : 50;
  const defY = isBlue ? PITCH_HEIGHT - 150 : 150;
  const fwY = isBlue ? PITCH_HEIGHT - 350 : 350;

  // GK
  const gk = createPlayer(`${team}-gk`, 'GK', team, PITCH_WIDTH / 2, gkY, usedNames);
  usedNames.push(gk.name);
  players.push(gk);

  // 3 Defenders
  const defPositions = [100, 200, 300];
  defPositions.forEach((x, i) => {
    const df = createPlayer(`${team}-df-${i}`, 'DF', team, x, defY, usedNames);
    usedNames.push(df.name);
    players.push(df);
  });

  // 3 Forwards
  const fwPositions = [100, 200, 300];
  fwPositions.forEach((x, i) => {
    const fw = createPlayer(`${team}-fw-${i}`, 'FW', team, x, fwY, usedNames);
    usedNames.push(fw.name);
    players.push(fw);
  });

  return players;
};

export const distance = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
};

export const moveTowards = (
  current: { x: number; y: number },
  target: { x: number; y: number },
  speed: number
): { x: number; y: number } => {
  const dist = distance(current.x, current.y, target.x, target.y);
  if (dist < speed) return target;
  
  const ratio = speed / dist;
  return {
    x: current.x + (target.x - current.x) * ratio,
    y: current.y + (target.y - current.y) * ratio,
  };
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const getPlayerWithBall = (players: Player[]): Player | undefined => {
  return players.find(p => p.hasBall);
};

export const getNearestPlayer = (
  x: number,
  y: number,
  players: Player[],
  excludeId?: string
): Player | undefined => {
  return players
    .filter(p => p.id !== excludeId)
    .sort((a, b) => distance(x, y, a.x, a.y) - distance(x, y, b.x, b.y))[0];
};

export const getOpponentGoalY = (team: Team): number => {
  return team === 'blue' ? 30 : PITCH_HEIGHT - 30;
};

export const isInPenaltyArea = (x: number, y: number, targetTeam: Team): boolean => {
  const goalY = targetTeam === 'red' ? 0 : PITCH_HEIGHT;
  const penaltyTop = targetTeam === 'red' ? 0 : PITCH_HEIGHT - 100;
  const penaltyBottom = targetTeam === 'red' ? 100 : PITCH_HEIGHT;
  
  return x > 100 && x < 300 && y > penaltyTop && y < penaltyBottom;
};
