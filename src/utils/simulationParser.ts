import { SimEvent, SimEventType, ParsedMatch } from '@/types/simulation';

export function parseSimulationFile(content: string): ParsedMatch {
  const lines = content.trim().split('\n');
  const events: SimEvent[] = [];
  let formation = { t1: '', t2: '' };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // First line is formation: "42 vs 24"
    if (i === 0 && line.includes(' vs ')) {
      const [t1, t2] = line.split(' vs ').map(s => s.trim());
      formation = { t1, t2 };
      continue;
    }

    const event = parseLine(line);
    if (event) {
      events.push(event);
    }
  }

  return { formation, events };
}

function parseLine(line: string): SimEvent | null {
  const parts = line.split(' ');
  const command = parts[0];

  const eventTypes: SimEventType[] = [
    'startMatch', 'endMatch', 'startHalf', 'endHalf', 'startTurn', 'endTurn',
    'wonKickoff', 'passBall', 'lostBall', 'shotGoal', 'shotFailed',
    'fwDfDuelSuccess', 'fwDfDuelFailed', 'decrementStamina', 'incrementRage'
  ];

  if (eventTypes.includes(command as SimEventType)) {
    return {
      type: command as SimEventType,
      params: parts.slice(1),
      raw: line
    };
  }

  return null;
}

export function parseFormation(formationStr: string): { defenders: number; forwards: number } {
  // "42" => 4 defenders, 2 forwards
  if (formationStr.length === 2) {
    return {
      defenders: parseInt(formationStr[0]),
      forwards: parseInt(formationStr[1])
    };
  }
  return { defenders: 4, forwards: 2 };
}

export function parsePlayerId(id: string): { team: 'T1' | 'T2'; role: 'G' | 'D' | 'F'; index: number } | null {
  const match = id.match(/^(T[12])-([GDF])(\d*)$/);
  if (!match) return null;
  
  return {
    team: match[1] as 'T1' | 'T2',
    role: match[2] as 'G' | 'D' | 'F',
    index: match[3] ? parseInt(match[3]) : 0
  };
}

export function parseStaminaRage(value: string): { change: number; current: number } {
  // "4.0|96.0" => change: 4, current: 96
  const [change, current] = value.split('|').map(v => parseFloat(v));
  return { change, current };
}
