import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

export function StatsCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'brand' | 'green' | 'yellow' | 'blue';
}) {
  const iconColors = {
    brand: 'bg-brand-light text-brand',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    blue: 'bg-blue-50 text-blue-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex items-start gap-4">
      <div className={clsx('p-2.5 rounded-lg', iconColors[accent ?? 'brand'])}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 truncate">{label}</p>
        <p className="text-2xl font-semibold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
