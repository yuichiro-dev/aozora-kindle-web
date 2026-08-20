'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, History, HelpCircle } from 'lucide-react';

export default function Header() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // 画面最上部付近（10px以内）では常に表示
      if (currentScrollY <= 10) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY) {
        // スクロールダウンで非表示
        setIsVisible(false);
      } else {
        // スクロールアップで表示
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const handleHomeClick = () => {
    if (pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <header
      className={`sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-stone-200 transition-transform duration-300 md:translate-y-0 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="max-w-4xl mx-auto px-4 md:px-10 h-16 flex items-center justify-between">
        <Link
          href="/"
          onClick={handleHomeClick}
          className="flex items-center gap-2.5 group focus:outline-none cursor-pointer"
          title="ホームに戻る"
        >
          <BookOpen className="w-6 h-6 shrink-0 text-stone-800 group-hover:text-stone-600 transition-colors" />
          <span className="font-bold font-serif text-lg md:text-xl text-stone-900 leading-none group-hover:text-stone-600 transition-colors">
            青空保存 to Kindle
          </span>
        </Link>

        {/* PC / マウス操作用ナビゲーション */}
        <nav className="hidden [@media(pointer:fine)]:flex items-center gap-2">
          <Link
            href="/history"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-lg transition-colors ${
              pathname === '/history'
                ? 'bg-stone-900 text-white'
                : 'text-stone-700 bg-stone-100 hover:bg-stone-200'
            }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span>履歴</span>
          </Link>
          <Link
            href="/guide"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-lg transition-colors ${
              pathname === '/guide'
                ? 'bg-stone-900 text-white'
                : 'text-stone-700 bg-stone-100 hover:bg-stone-200'
            }`}
          >
            <HelpCircle className="w-4 h-4 shrink-0" />
            <span>使い方</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
