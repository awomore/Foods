import clsx from 'clsx';

const variants = {
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-700',
  orange: 'bg-orange-100 text-orange-800',
} as const;

export function Badge({
  label,
  variant = 'gray',
}: {
  label: string;
  variant?: keyof typeof variants;
}) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', variants[variant])}>
      {label}
    </span>
  );
}

export function statusVariant(status: string): keyof typeof variants {
  switch (status) {
    case 'active': case 'completed': case 'delivered': case 'true': return 'green';
    case 'suspended': case 'cancelled': case 'refunded': return 'red';
    case 'pending': case 'pending_payment': return 'yellow';
    case 'confirmed': case 'preparing': case 'paid': return 'blue';
    case 'ready': case 'in_transit': case 'picked_up': return 'orange';
    default: return 'gray';
  }
}
