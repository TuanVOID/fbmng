import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TurnInputProps {
  value: number;
  onChange: (value: number) => void;
}

export const TurnInput = ({ value, onChange }: TurnInputProps) => {
  return (
    <div className="flex items-center gap-3 bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700">
      <Label htmlFor="turns" className="text-gray-300 whitespace-nowrap font-medium">
        Số Turn:
      </Label>
      <Input
        id="turns"
        type="number"
        min={1}
        max={99}
        value={value}
        onChange={(e) => {
          const val = parseInt(e.target.value) || 1;
          onChange(Math.max(1, Math.min(99, val)));
        }}
        className="w-20 bg-gray-900 border-gray-600 text-center text-white font-bold text-lg"
      />
      <span className="text-gray-500 text-sm">(mỗi turn = 1 bàn hoặc 1 lần cản phá)</span>
    </div>
  );
};
