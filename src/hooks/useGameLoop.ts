import { useState, useCallback, useEffect } from 'react';
import { GameState, Player, LogEntry, GamePhase, Team } from '@/types/game';
import {
  createTeam,
  distance,
  moveTowards,
  clamp,
} from '@/utils/gameUtils';

const PITCH_WIDTH = 400;
const PITCH_HEIGHT = 600;
const PLAYER_RADIUS = 15;
const TACKLE_DISTANCE = 30;
const PASSING_LINE_Y = PITCH_HEIGHT / 2; // Đường ngang giữa sân
const PENALTY_AREA_Y_BLUE = 100; // Vùng 16m50 đội blue (đầu sân)
const PENALTY_AREA_Y_RED = PITCH_HEIGHT - 100; // Vùng 16m50 đội red (cuối sân)
const BASE_SPEED = 1.5;
const FAST_SPEED = 2.5;
const DASH_SPEED = 8;

const generateId = () => Math.random().toString(36).slice(2, 9);

export const useGameLoop = () => {
  const [gameState, setGameState] = useState<GameState>(() => initializeGame());

  function initializeGame(): GameState {
    const bluePlayers = createTeam('blue');
    const redPlayers = createTeam('red');
    
    return {
      phase: 'idle',
      players: [...bluePlayers, ...redPlayers],
      ball: { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2, ownerId: null },
      score: { blue: 0, red: 0 },
      matchLog: [],
      selectedPlayerId: null,
      isRunning: false,
      matchTime: 0,
      attackingTeam: 'blue',
      phaseTimer: 0,
    };
  }

  const startMatch = useCallback(() => {
    const bluePlayers = createTeam('blue');
    const redPlayers = createTeam('red');
    
    // GK đội blue cầm bóng đầu tiên
    const blueGK = bluePlayers.find(p => p.role === 'GK');
    if (blueGK) {
      blueGK.hasBall = true;
    }

    setGameState({
      phase: 'gk_has_ball',
      players: [...bluePlayers, ...redPlayers],
      ball: {
        x: blueGK?.x || PITCH_WIDTH / 2,
        y: blueGK?.y || PITCH_HEIGHT - 50,
        ownerId: blueGK?.id || null,
      },
      score: { blue: 0, red: 0 },
      matchLog: [{ id: generateId(), time: 0, message: '🏟️ Trận đấu bắt đầu!', type: 'info' }],
      selectedPlayerId: null,
      isRunning: true,
      matchTime: 0,
      attackingTeam: 'blue',
      phaseTimer: 0,
    });
  }, []);

  const selectPlayer = useCallback((playerId: string | null) => {
    setGameState(prev => ({ ...prev, selectedPlayerId: playerId }));
  }, []);

  const performDuel = (attacker: Player, defender: Player): 'attacker' | 'defender' => {
    const attackerPower = attacker.stats.atk + (attacker.isSkillActive && attacker.skill.type === 'attack' ? 30 : 0);
    const defenderPower = defender.stats.def + (defender.isSkillActive && defender.skill.type === 'defense' ? 30 : 0);
    
    const attackerRoll = attackerPower + Math.random() * 40;
    const defenderRoll = defenderPower + Math.random() * 40;
    
    return attackerRoll > defenderRoll ? 'attacker' : 'defender';
  };

  const attemptShot = (shooter: Player, goalkeeper: Player): boolean => {
    const shooterPower = shooter.stats.atk + (shooter.isSkillActive && shooter.skill.type === 'attack' ? 50 : 0);
    const gkPower = goalkeeper.stats.def + (goalkeeper.isSkillActive ? 50 : 0);
    
    const shooterRoll = shooterPower + Math.random() * 50;
    const gkRoll = gkPower + Math.random() * 30;
    
    return shooterRoll > gkRoll;
  };

  const getGoalY = (team: Team): number => {
    // Blue tấn công lên trên (y = 0), Red tấn công xuống dưới (y = max)
    return team === 'blue' ? 30 : PITCH_HEIGHT - 30;
  };

  const getMidfieldY = (): number => PITCH_HEIGHT / 2;

  const updateGame = useCallback(() => {
    setGameState(prev => {
      if (!prev.isRunning || prev.phase === 'idle') return prev;

      let newState = { ...prev };
      let players = prev.players.map(p => ({ ...p }));
      let ball = { ...prev.ball };
      let logs: { message: string; type: LogEntry['type'] }[] = [];
      let newPhase: GamePhase = prev.phase;

      newState.matchTime = prev.matchTime + 1;
      newState.phaseTimer = prev.phaseTimer + 1;

      // Update rage
      players = players.map(p => ({
        ...p,
        rage: Math.min(p.maxRage, p.rage + 0.2),
        isSkillActive: p.rage >= p.maxRage,
      }));

      const attackingTeam = prev.attackingTeam;
      const defendingTeam = attackingTeam === 'blue' ? 'red' : 'blue';
      const goalY = getGoalY(attackingTeam);
      const isAttackingUp = attackingTeam === 'blue'; // Blue tấn công lên (y giảm)

      const ballHolder = players.find(p => p.hasBall);
      const attackingPlayers = players.filter(p => p.team === attackingTeam);
      const defendingPlayers = players.filter(p => p.team === defendingTeam);

      switch (prev.phase) {
        case 'gk_has_ball': {
          // Tất cả cầu thủ di chuyển về vị trí cơ bản
          let allInPosition = true;
          players = players.map(p => {
            const dist = distance(p.x, p.y, p.baseX, p.baseY);
            if (dist > 5 && p.role !== 'GK') {
              allInPosition = false;
              const speed = FAST_SPEED;
              const newPos = moveTowards({ x: p.x, y: p.y }, { x: p.baseX, y: p.baseY }, speed);
              return { ...p, x: newPos.x, y: newPos.y };
            }
            return p;
          });

          // Sau khi về vị trí hoặc sau 60 frames, GK chuyền cho hậu vệ
          if ((allInPosition || prev.phaseTimer > 60) && ballHolder?.role === 'GK') {
            const nearestDF = attackingPlayers
              .filter(p => p.role === 'DF')
              .sort((a, b) => distance(ballHolder.x, ballHolder.y, a.x, a.y) - distance(ballHolder.x, ballHolder.y, b.x, b.y))[0];
            
            if (nearestDF) {
              logs.push({ message: `📤 ${ballHolder.name} chuyền bóng cho ${nearestDF.name}`, type: 'pass' });
              players = players.map(p => ({
                ...p,
                hasBall: p.id === nearestDF.id,
              }));
              ball = { x: nearestDF.x, y: nearestDF.y, ownerId: nearestDF.id };
              newPhase = 'df_buildup';
              newState.phaseTimer = 0;
            }
          }
          break;
        }

        case 'df_buildup': {
          // Hậu vệ cầm bóng di chuyển lên phía đối phương
          if (ballHolder && ballHolder.role === 'DF') {
            const targetY = isAttackingUp ? PASSING_LINE_Y + 50 : PASSING_LINE_Y - 50;
            const speed = BASE_SPEED + ballHolder.stats.spd / 80;
            
            // Di chuyển hậu vệ cầm bóng
            const newPos = moveTowards(
              { x: ballHolder.x, y: ballHolder.y },
              { x: ballHolder.x, y: targetY },
              speed
            );
            players = players.map(p =>
              p.id === ballHolder.id ? { ...p, x: newPos.x, y: newPos.y } : p
            );
            ball = { x: newPos.x, y: newPos.y, ownerId: ballHolder.id };

            // Tiền đạo bên tấn công di chuyển lên phần sân địch
            const forwardTargetY = isAttackingUp ? PITCH_HEIGHT / 3 : (PITCH_HEIGHT * 2) / 3;
            players = players.map(p => {
              if (p.team === attackingTeam && p.role === 'FW' && !p.hasBall) {
                const speed = BASE_SPEED + p.stats.spd / 80;
                const newPos = moveTowards({ x: p.x, y: p.y }, { x: p.baseX, y: forwardTargetY }, speed);
                return { ...p, x: newPos.x, y: newPos.y };
              }
              return p;
            });

            // Kiểm tra nếu hậu vệ đã đến gần đường giữa sân -> chuyền
            const distToPassLine = Math.abs(ballHolder.y - PASSING_LINE_Y);
            if (distToPassLine < 80) {
              newPhase = 'df_passing';
              newState.phaseTimer = 0;
            }
          }
          break;
        }

        case 'df_passing': {
          // Hậu vệ chuyền bóng cho tiền đạo
          if (ballHolder && ballHolder.role === 'DF') {
            const forwards = attackingPlayers.filter(p => p.role === 'FW');
            const targetFW = forwards[Math.floor(Math.random() * forwards.length)];
            
            if (targetFW) {
              // Tỉ lệ nhỏ bị mất bóng vào tay tiền đạo đối phương
              const interceptionChance = 0.15;
              const isIntercepted = Math.random() < interceptionChance;
              
              if (isIntercepted) {
                const opponentFWs = defendingPlayers.filter(p => p.role === 'FW');
                const interceptor = opponentFWs[Math.floor(Math.random() * opponentFWs.length)];
                
                if (interceptor) {
                  logs.push({ message: `🔄 ${interceptor.name} chặn đường chuyền của ${ballHolder.name}!`, type: 'action' });
                  players = players.map(p => ({
                    ...p,
                    hasBall: p.id === interceptor.id,
                  }));
                  ball = { x: interceptor.x, y: interceptor.y, ownerId: interceptor.id };
                  // Đổi đội tấn công
                  newState.attackingTeam = defendingTeam;
                  newPhase = 'fw_attacking';
                  newState.phaseTimer = 0;
                  break;
                }
              }
              
              logs.push({ message: `📤 ${ballHolder.name} chuyền bóng cho ${targetFW.name}`, type: 'pass' });
              players = players.map(p => ({
                ...p,
                hasBall: p.id === targetFW.id,
              }));
              ball = { x: targetFW.x, y: targetFW.y, ownerId: targetFW.id };
              newPhase = 'fw_attacking';
              newState.phaseTimer = 0;
            }
          }
          break;
        }

        case 'fw_attacking': {
          if (ballHolder && ballHolder.role === 'FW') {
            const speed = BASE_SPEED + ballHolder.stats.spd / 60;
            
            // Tiền đạo cầm bóng di chuyển về phía khung thành
            const newPos = moveTowards(
              { x: ballHolder.x, y: ballHolder.y },
              { x: PITCH_WIDTH / 2, y: goalY },
              speed
            );
            players = players.map(p =>
              p.id === ballHolder.id ? { ...p, x: newPos.x, y: newPos.y } : p
            );
            ball = { x: newPos.x, y: newPos.y, ownerId: ballHolder.id };

            // Toàn bộ đội tấn công dâng lên, nhưng hậu vệ chỉ đến nửa sân
            players = players.map(p => {
              if (p.team === attackingTeam && !p.hasBall && p.role !== 'GK') {
                const maxY = p.role === 'DF' 
                  ? (isAttackingUp ? PASSING_LINE_Y : PASSING_LINE_Y)
                  : goalY;
                const targetY = isAttackingUp 
                  ? Math.max(p.y - 1, maxY)
                  : Math.min(p.y + 1, maxY);
                return { ...p, y: targetY };
              }
              return p;
            });

            // Hậu vệ bên thủ lùi dần về khung thành
            players = players.map(p => {
              if (p.team === defendingTeam && p.role === 'DF') {
                const retreatY = isAttackingUp ? p.baseY - 30 : p.baseY + 30;
                const speed = BASE_SPEED + p.stats.spd / 80;
                const newPos = moveTowards({ x: p.x, y: p.y }, { x: p.x, y: retreatY }, speed);
                return { ...p, x: newPos.x, y: newPos.y };
              }
              return p;
            });

            // Kiểm tra va chạm với hậu vệ
            const defendingDFs = defendingPlayers.filter(p => p.role === 'DF');
            for (const defender of defendingDFs) {
              const dist = distance(ballHolder.x, ballHolder.y, defender.x, defender.y);
              if (dist < TACKLE_DISTANCE) {
                newPhase = 'duel';
                newState.phaseTimer = 0;
                logs.push({ message: `⚔️ ${ballHolder.name} đối đầu ${defender.name}!`, type: 'duel' });
                break;
              }
            }

            // Nếu tiền đạo vào vùng 16m50 mà không bị chặn -> sút
            const penaltyY = isAttackingUp ? PENALTY_AREA_Y_BLUE : PENALTY_AREA_Y_RED;
            const inPenaltyArea = isAttackingUp 
              ? ballHolder.y < penaltyY 
              : ballHolder.y > penaltyY;
            
            if (inPenaltyArea) {
              newPhase = 'shooting';
              newState.phaseTimer = 0;
            }
          }
          break;
        }

        case 'duel': {
          const attacker = players.find(p => p.hasBall && p.role === 'FW');
          const defenders = defendingPlayers.filter(p => p.role === 'DF');
          const nearestDefender = defenders
            .sort((a, b) => {
              if (!attacker) return 0;
              return distance(attacker.x, attacker.y, a.x, a.y) - distance(attacker.x, attacker.y, b.x, b.y);
            })[0];

          if (attacker && nearestDefender) {
            const winner = performDuel(attacker, nearestDefender);

            if (winner === 'attacker') {
              // Tiền đạo thắng - dash vượt qua
              if (attacker.isSkillActive) {
                logs.push({ message: `⚡ ${attacker.name} sử dụng ${attacker.skill.emoji} ${attacker.skill.name}!`, type: 'skill' });
              }
              logs.push({ message: `🏃 ${attacker.name} vượt qua ${nearestDefender.name}!`, type: 'duel' });
              
              // Dash về phía khung thành
              const dashDirection = isAttackingUp ? -1 : 1;
              players = players.map(p => {
                if (p.id === attacker.id) {
                  return { 
                    ...p, 
                    y: p.y + (dashDirection * DASH_SPEED * 5),
                    isDashing: true,
                    rage: 0,
                    isSkillActive: false,
                  };
                }
                return p;
              });
              const newAttacker = players.find(p => p.id === attacker.id)!;
              ball = { x: newAttacker.x, y: newAttacker.y, ownerId: attacker.id };
              newPhase = 'fw_breakthrough';
            } else {
              // Hậu vệ thắng - cắt bóng
              if (nearestDefender.isSkillActive) {
                logs.push({ message: `🛡️ ${nearestDefender.name} sử dụng ${nearestDefender.skill.emoji} ${nearestDefender.skill.name}!`, type: 'skill' });
              }
              logs.push({ message: `💪 ${nearestDefender.name} cắt bóng từ ${attacker.name}!`, type: 'duel' });
              
              players = players.map(p => ({
                ...p,
                hasBall: p.id === nearestDefender.id,
                isDashing: p.id === nearestDefender.id,
                rage: p.id === nearestDefender.id ? 0 : p.rage,
                isSkillActive: p.id === nearestDefender.id ? false : p.isSkillActive,
              }));
              ball = { x: nearestDefender.x, y: nearestDefender.y, ownerId: nearestDefender.id };
              
              // Đổi đội tấn công
              newState.attackingTeam = defendingTeam;
              newPhase = 'df_buildup';
            }
            newState.phaseTimer = 0;
          }
          break;
        }

        case 'fw_breakthrough': {
          // Tiền đạo tiếp tục tiến về vùng 16m50
          const attacker = players.find(p => p.hasBall && p.role === 'FW');
          
          if (attacker) {
            const speed = FAST_SPEED + attacker.stats.spd / 50;
            const newPos = moveTowards(
              { x: attacker.x, y: attacker.y },
              { x: PITCH_WIDTH / 2, y: goalY },
              speed
            );
            players = players.map(p =>
              p.id === attacker.id ? { ...p, x: newPos.x, y: newPos.y, isDashing: false } : p
            );
            ball = { x: newPos.x, y: newPos.y, ownerId: attacker.id };

            // Kiểm tra nếu vào vùng 16m50
            const penaltyY = isAttackingUp ? PENALTY_AREA_Y_BLUE : PENALTY_AREA_Y_RED;
            const inPenaltyArea = isAttackingUp 
              ? attacker.y < penaltyY + 20
              : attacker.y > penaltyY - 20;
            
            if (inPenaltyArea || prev.phaseTimer > 40) {
              newPhase = 'shooting';
              newState.phaseTimer = 0;
            }
          }
          break;
        }

        case 'shooting': {
          const shooter = players.find(p => p.hasBall);
          const goalkeeper = defendingPlayers.find(p => p.role === 'GK');
          
          if (shooter && goalkeeper) {
            if (shooter.isSkillActive) {
              logs.push({ message: `⚡ ${shooter.name} sử dụng ${shooter.skill.emoji} ${shooter.skill.name}!`, type: 'skill' });
            }
            logs.push({ message: `⚽ ${shooter.name} sút bóng!`, type: 'action' });

            const isGoal = attemptShot(shooter, goalkeeper);

            if (isGoal) {
              logs.push({ message: `🎉 GOAL! ${shooter.name} ghi bàn cho đội ${attackingTeam.toUpperCase()}!`, type: 'goal' });
              newState.score = {
                ...prev.score,
                [attackingTeam]: prev.score[attackingTeam] + 1,
              };
              newPhase = 'goal';
            } else {
              if (goalkeeper.isSkillActive) {
                logs.push({ message: `🧤 ${goalkeeper.name} sử dụng ${goalkeeper.skill.emoji} ${goalkeeper.skill.name}!`, type: 'skill' });
              }
              logs.push({ message: `🧤 ${goalkeeper.name} cản phá thành công!`, type: 'action' });
              newPhase = 'save';
            }
            newState.phaseTimer = 0;
          }
          break;
        }

        case 'goal':
        case 'save': {
          // Bóng về thủ môn đội phòng ngự
          const goalkeeper = defendingPlayers.find(p => p.role === 'GK');
          
          if (goalkeeper && prev.phaseTimer > 30) {
            players = players.map(p => ({
              ...p,
              hasBall: p.id === goalkeeper.id,
              isDashing: false,
              rage: p.role === 'GK' ? 0 : p.rage,
              isSkillActive: false,
            }));
            ball = { x: goalkeeper.x, y: goalkeeper.y, ownerId: goalkeeper.id };
            
            // Đổi đội tấn công
            newState.attackingTeam = defendingTeam;
            newPhase = 'gk_has_ball';
            newState.phaseTimer = 0;
          }
          break;
        }

        case 'reset': {
          // Reset tất cả về vị trí
          players = players.map(p => ({
            ...p,
            x: p.baseX,
            y: p.baseY,
            hasBall: false,
            isDashing: false,
          }));
          newPhase = 'gk_has_ball';
          newState.phaseTimer = 0;
          break;
        }
      }

      // Thêm logs
      logs.forEach(log => {
        newState.matchLog = [
          { id: generateId(), time: newState.matchTime, message: log.message, type: log.type },
          ...newState.matchLog.slice(0, 49),
        ];
      });

      return { ...newState, players, ball, phase: newPhase };
    });
  }, []);

  useEffect(() => {
    if (gameState.isRunning) {
      const interval = setInterval(updateGame, 50);
      return () => clearInterval(interval);
    }
  }, [gameState.isRunning, updateGame]);

  return {
    gameState,
    startMatch,
    selectPlayer,
  };
};
