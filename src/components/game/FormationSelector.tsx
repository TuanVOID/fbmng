import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

export type Formation = '2-4' | '3-3' | '4-2';

interface TeamFormationSelectorProps {
  team: 'blue' | 'red';
  selectedFormation: Formation;
  onSelectFormation: (formation: Formation) => void;
}

const formations: { value: Formation; label: string; description: string }[] = [
  { value: '2-4', label: '2-4', description: '2 DF - 4 FW' },
  { value: '3-3', label: '3-3', description: '3 DF - 3 FW' },
  { value: '4-2', label: '4-2', description: '4 DF - 2 FW' },
];

export const TeamFormationSelector = ({ team, selectedFormation, onSelectFormation }: TeamFormationSelectorProps) => {
  const isBlue = team === 'blue';
  const teamColor = isBlue ? 'from-blue-500 to-blue-600' : 'from-red-500 to-red-600';
  const teamLabel = isBlue ? '🔵 Đội Xanh' : '🔴 Đội Đỏ';
  const borderColor = isBlue ? 'border-blue-500/50' : 'border-red-500/50';
  const bgColor = isBlue ? 'bg-blue-900/30' : 'bg-red-900/30';

  return (
    <motion.div
      className={`${bgColor} backdrop-blur-sm rounded-xl p-3 border ${borderColor}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h3 className="text-xs font-semibold text-gray-300 mb-2 text-center">
        {teamLabel}
      </h3>
      <div className="flex gap-1">
        {formations.map((formation) => (
          <Button
            key={formation.value}
            variant={selectedFormation === formation.value ? 'default' : 'outline'}
            size="sm"
            className={`flex-1 flex flex-col h-auto py-1.5 px-2 ${
              selectedFormation === formation.value
                ? `bg-gradient-to-r ${teamColor} border-none text-white`
                : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-600/50'
            }`}
            onClick={() => onSelectFormation(formation.value)}
          >
            <span className="text-sm font-bold">{formation.label}</span>
            <span className="text-[9px] opacity-80">{formation.description}</span>
          </Button>
        ))}
      </div>
    </motion.div>
  );
};

interface FormationSelectorProps {
  blueFormation: Formation;
  redFormation: Formation;
  onSelectBlueFormation: (formation: Formation) => void;
  onSelectRedFormation: (formation: Formation) => void;
}

export const FormationSelector = ({
  blueFormation,
  redFormation,
  onSelectBlueFormation,
  onSelectRedFormation,
}: FormationSelectorProps) => {
  return (
    <div className="flex gap-3">
      <TeamFormationSelector
        team="blue"
        selectedFormation={blueFormation}
        onSelectFormation={onSelectBlueFormation}
      />
      <TeamFormationSelector
        team="red"
        selectedFormation={redFormation}
        onSelectFormation={onSelectRedFormation}
      />
    </div>
  );
};