'use client';

import { useEffect, useRef, useState } from 'react';

import { X } from 'lucide-react';

import type { Suggestion } from '@/lib/bookSearch';

type SearchBarProps = {
  value: string;
  suggestions: Suggestion[];
  disabled?: boolean;
  onChange: (value: string) => void;
  onSelect: (text: string) => void;
  onClear: () => void;
};

export default function SearchBar({
  value,
  suggestions,
  disabled = false,
  onChange,
  onSelect,
  onClear,
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleChange = (nextValue: string) => {
    onChange(nextValue);
    setIsFocused(true);
  };

  const handleSelect = (text: string) => {
    onSelect(text);
    setIsFocused(false);

    inputRef.current?.blur();
  };

  const handleClear = () => {
    onClear();
    setIsFocused(false);
  };

  return (
    <div ref={searchContainerRef} className="relative group z-30">
      <div className="relative bg-card border-2 border-border focus-within:border-foreground rounded-xl shadow-md flex items-center transition-colors">
        <div className="pl-4 text-muted-foreground shrink-0">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="text"
          placeholder="著者名や作品名で検索"
          value={value}
          onFocus={() => setIsFocused(true)}
          onChange={(event) => handleChange(event.target.value)}
          disabled={disabled}
          className="w-full pl-3 pr-2 py-3 bg-transparent rounded-xl focus:outline-none text-base font-medium text-foreground placeholder:text-muted-foreground disabled:bg-muted"
        />

        {value.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="pr-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
            aria-label="検索をクリアしてホームに戻る"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {isFocused && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 divide-y divide-border">
          {suggestions.map((item, index) => (
            <button
              key={`${item.type}-${item.text}-${index}`}
              type="button"
              onClick={() => handleSelect(item.text)}
              className="w-full text-left px-4 py-3 hover:bg-muted active:bg-muted/80 flex items-center gap-2.5 transition-colors"
            >
              <span className="text-sm shrink-0">{item.type === 'author' ? '👤' : '📖'}</span>

              <span className="text-sm sm:text-base font-bold text-foreground truncate">
                {item.text}
              </span>

              <span className="text-xs font-medium text-muted-foreground ml-auto shrink-0">
                {item.type === 'author' ? '作者' : '作品'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
