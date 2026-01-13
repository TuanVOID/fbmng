import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

export type Formation = '2-4' | '3-3' | '4-2';

interface FormationSelectorProps {
  selectedFormation: Formation;
  onSelectFormation: (formation: Formation) => void;
}

const formations: { value: Formation; label: string; description: string }[] = [
  { value: '2-4', label: '2-4', description: '2 Hậu vệ - 4 Tiền đạo' },
  { value: '3-3', label: '3-3', description: '3 Hậu vệ - 3 Tiền đạo' },
  { value: '4-2', label: '4-2', description: '4 Hậu vệ - 2 Tiền đạo' },
];

export const FormationSelector = ({ selectedFormation, onSelectFormation }: FormationSelectorProps) => {
  return (
    <motion.div
      className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-gray-700"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h3 className="text-sm font-semibold text-gray-300 mb-3 text-center">
        ⚽ Chọn đội hình
      </h3>
      <div className="flex gap-2">
        {formations.map((formation) => (
          <Button
            key={formation.value}
            variant={selectedFormation === formation.value ? 'default' : 'outline'}
            size="sm"
            className={`flex-1 flex flex-col h-auto py-2 ${
              selectedFormation === formation.value
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 border-none text-white'
                : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-600/50'
            }`}
            onClick={() => onSelectFormation(formation.value)}
          >
            <span className="text-lg font-bold">{formation.label}</span>
            <span className="text-[10px] opacity-80">{formation.description}</span>
          </Button>
        ))}
      </div>
    </motion.div>
  );
};
