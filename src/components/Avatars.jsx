// Deep Blunder: mismatched googly eyes, a bandage, and a wobbly smile.
export function BotAvatar({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="Deep Blunder" role="img">
      <rect width="64" height="64" rx="10" fill="#3d6e8f" />
      <line x1="32" y1="9" x2="32" y2="17" stroke="#9aa3b2" strokeWidth="3" />
      <circle cx="32" cy="8" r="4" fill="#ff5c5c" />
      <rect x="7" y="27" width="5" height="12" rx="2" fill="#9aa3b2" />
      <rect x="52" y="27" width="5" height="12" rx="2" fill="#9aa3b2" />
      <rect x="11" y="16" width="42" height="36" rx="10" fill="#d7dce3" stroke="#59606d" strokeWidth="2.5" />
      <circle cx="24" cy="31" r="8" fill="#fff" stroke="#59606d" strokeWidth="2" />
      <circle cx="26.5" cy="33.5" r="3.6" fill="#1d1f24" />
      <circle cx="42" cy="29" r="5" fill="#fff" stroke="#59606d" strokeWidth="2" />
      <circle cx="40.5" cy="27.2" r="2.2" fill="#1d1f24" />
      <path d="M21 44q4 3.5 8 0t8 0 7 1" fill="none" stroke="#59606d" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="38" y="15" width="14" height="5.5" rx="1.5" fill="#f3c9a3" transform="rotate(28 45 18)" />
    </svg>
  );
}

const COLORS = ['#c0573e', '#4f8a3c', '#3c6fa8', '#8a4fa8', '#b8862e', '#2e8a85', '#a83c6f', '#5a6b7d'];

export function PlayerAvatar({ name, size = 40 }) {
  const n = (name || '?').trim() || '?';
  let h = 0;
  for (const ch of n) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return (
    <div className="letter-avatar" style={{ width: size, height: size, background: COLORS[h % COLORS.length], fontSize: size * 0.48 }}>
      {[...n][0].toUpperCase()}
    </div>
  );
}
