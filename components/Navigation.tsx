'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'מה שקורה עכשיו' },
    { href: '/my-shifts', label: 'השמירות שלי' },
    { href: '/all-shifts', label: 'לוח השמירות' },
    { href: '/admin', label: 'ניהול שמירה' },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800">
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 text-[15px] font-medium rounded-lg transition-all ${
                  pathname === item.href
                    ? 'text-black dark:text-white bg-neutral-100 dark:bg-neutral-900'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-900/50'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <a
            href="/USER_MANUAL_HE.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full border-2 border-neutral-400 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:border-neutral-900 dark:hover:border-neutral-100 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
            title="מדריך למשתמש"
          >
            <span className="text-base font-bold">i</span>
          </a>
        </div>
      </div>
    </nav>
  );
}
