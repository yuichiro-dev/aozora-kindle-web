'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, History, HelpCircle } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'ホーム', icon: Home },
  { href: '/history', label: '履歴', icon: History },
  { href: '/guide', label: '使い方', icon: HelpCircle },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200 bg-white/95 backdrop-blur-md md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-14 items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center py-1 text-[10px] transition-colors ${
                isActive ? 'font-semibold text-blue-600' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Icon className="h-5 w-5 mb-0.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
