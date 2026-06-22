'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import {
  LayoutDashboard, ChefHat, Users, ShoppingBag,
  Wallet, Star, LogOut, Loader2,
  AlertTriangle, BadgeCheck, Flag, ShieldAlert,
  Truck, Timer, RotateCcw, Settings, Radio, TrendingUp,
  MapPin, BarChart3,
} from 'lucide-react';
import clsx from 'clsx';

const NAV: Array<{ href: string; label: string; icon: React.ElementType } | 'divider'> = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/dashboard/disputes', label: 'Disputes', icon: AlertTriangle },
  { href: '/dashboard/delivery', label: 'Delivery / SLA', icon: Timer },
  'divider',
  { href: '/dashboard/cooks', label: 'Cooks', icon: ChefHat },
  { href: '/dashboard/customers', label: 'Customers', icon: Users },
  { href: '/dashboard/riders', label: 'Riders / Fleet', icon: Truck },
  { href: '/dashboard/riders/earnings', label: 'Rider Earnings', icon: TrendingUp },
  'divider',
  { href: '/dashboard/payouts', label: 'Payouts', icon: Wallet },
  { href: '/dashboard/refunds', label: 'Refunds', icon: RotateCcw },
  'divider',
  { href: '/dashboard/dispatch', label: 'Dispatch', icon: Radio },
  { href: '/dashboard/fleet-map', label: 'Fleet Map', icon: MapPin },
  { href: '/dashboard/dispatch-analytics', label: 'Dispatch Analytics', icon: BarChart3 },
  { href: '/dashboard/verifications', label: 'Verifications', icon: BadgeCheck },
  { href: '/dashboard/moderation', label: 'Moderation', icon: Flag },
  { href: '/dashboard/fraud', label: 'Fraud', icon: ShieldAlert },
  { href: '/dashboard/reviews', label: 'Reviews', icon: Star },
  'divider',
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100">
          <span className="text-lg font-bold text-brand">FOODSbyme</span>
          <p className="text-xs text-gray-400 mt-0.5">Admin Console</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map((item, i) => {
            if (item === 'divider') {
              return <div key={`div-${i}`} className="my-1.5 border-t border-gray-100" />;
            }
            const { href, label, icon: Icon } = item;
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-light text-brand'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-gray-700 truncate">{user.full_name ?? user.phone}</p>
            <p className="text-xs text-gray-400">{user.phone}</p>
          </div>
          <button
            onClick={() => { signOut(); router.replace('/login'); }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 w-full transition-colors"
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
