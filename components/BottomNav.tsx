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
    // マウス操作デバイス（PC）のときだけ非表示
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border [@media(pointer:fine)]:hidden z-50">
      <div className="flex items-center justify-around h-14 max-w-md mx-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
                isActive
                  ? 'text-foreground font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
