import { Clock } from 'lucide-react';

interface TimerProps {
  formattedTime: string;
  timerColor: string;
}

export default function Timer({ formattedTime, timerColor }: TimerProps) {
  return (
    <div
      className="flex items-center gap-2 font-mono text-sm font-semibold"
      style={{ color: timerColor }}
    >
      <Clock size={16} />
      <span>{formattedTime}</span>
    </div>
  );
}
