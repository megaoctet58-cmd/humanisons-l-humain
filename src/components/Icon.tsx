/** Jeu d'icônes en SVG (trait fin, sans dépendance). */
const P: Record<string, string> = {
  menu: 'M4 7h12M4 12h16M4 17h10',
  sun: 'M12 4V2M12 22v-2M4.9 4.9 3.5 3.5M20.5 20.5l-1.4-1.4M4 12H2M22 12h-2M4.9 19.1l-1.4 1.4M20.5 3.5l-1.4 1.4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3',
  play: 'M8 5.5v13l11-6.5-11-6.5Z',
  pause: 'M8 5v14M16 5v14',
  stop: 'M7 7h10v10H7z',
  upload: 'M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v4h14v-4',
  feed: 'M4 5h16M4 12h16M4 19h10',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4',
  pen: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  waves: 'M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0',
  close: 'M6 6l12 12M18 6 6 18',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp: 'M6 15l6-6 6 6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  share: 'M12 15V3M7.5 7.5 12 3l4.5 4.5M5 13v7h14v-7',
  bookmark: 'M6 3h12v18l-6-4-6 4V3Z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  check: 'M5 12.5 10 17l9-10',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  back: 'M15 5l-7 7 7 7',
  plus: 'M12 5v14M5 12h14',
  redo: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z',
  book: 'M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4V4ZM5 16a4 4 0 0 1 4-4h9',
  info: 'M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  speak: 'M4 5h16v11H9l-5 4V5ZM8 10h8',
  hand: 'M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 9a1.5 1.5 0 0 1 3 0v4a8 8 0 0 1-8 8 6 6 0 0 1-5-3l-2.5-4.5a1.5 1.5 0 0 1 2.6-1.5L7 14',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z',
  bolt: 'M13 3 5 13h6l-1 8 8-10h-6l1-8Z',
  question: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Z',
  download: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14',
  file: 'M6 3h8l4 4v14H6V3ZM14 3v4h4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
};

export function Icon({ name, size = 20, filled = false, className }: { name: string; size?: number; filled?: boolean; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={P[name] ?? P.info} />
    </svg>
  );
}
