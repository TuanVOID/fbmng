export const petNames = [
  'Fluffy', 'Shadow', 'Luna', 'Max', 'Bella', 'Charlie', 'Milo', 'Coco',
  'Rocky', 'Buddy', 'Duke', 'Bear', 'Tucker', 'Jack', 'Leo', 'Zeus',
  'Toby', 'Oscar', 'Finn', 'Murphy', 'Rusty', 'Scout', 'Rex', 'Bruno',
  'Spike', 'Flash', 'Storm', 'Blaze', 'Thunder', 'Rocket', 'Ace', 'Dash',
  'Hunter', 'Tank', 'Bolt', 'Ghost', 'Ninja', 'Fang', 'Wolf', 'Tiger',
];

export const attackSkills = [
  { name: 'Fireball Shot', emoji: '🔥', type: 'attack' as const, effect: 'Increases goal chance by 50%' },
  { name: 'Thunder Strike', emoji: '⚡', type: 'attack' as const, effect: 'Guaranteed bypass one defender' },
  { name: 'Speed Burst', emoji: '💨', type: 'attack' as const, effect: 'Double speed for 3 seconds' },
  { name: 'Power Shot', emoji: '💥', type: 'attack' as const, effect: 'Unstoppable shot' },
];

export const defenseSkills = [
  { name: 'Iron Wall', emoji: '🛡️', type: 'defense' as const, effect: 'Guaranteed tackle success' },
  { name: 'Freeze Zone', emoji: '❄️', type: 'defense' as const, effect: 'Slow down attacker' },
  { name: 'Mirror Block', emoji: '🪞', type: 'defense' as const, effect: 'Reflect attack power' },
  { name: 'Shield Bash', emoji: '🔰', type: 'defense' as const, effect: 'Stun attacker briefly' },
];

export const gkSkills = [
  { name: 'Super Save', emoji: '🧤', type: 'defense' as const, effect: 'Guaranteed save' },
  { name: 'Time Freeze', emoji: '⏱️', type: 'defense' as const, effect: 'Stop time briefly' },
];
