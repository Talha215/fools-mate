// Gary: the club computer, drawn like a newsletter illustration.
export function Gary({ width = 120 }) {
  return (
    <svg className="gary" width={width} viewBox="0 0 100 96" role="img" aria-label="Gary, a beige desktop computer">
      <g fill="var(--paper-2)" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M12 10q0-4 4-4h68q4 0 4 4v52q0 4-4 4H16q-4 0-4-4z" />
        <path d="M20 15q0-2.4 3-2.8 27-2.2 54 0 3 .4 3 2.8v37q0 2.4-3 2.8-27 2.2-54 0-3-.4-3-2.8z" fill="var(--ink)" />
        <path d="M40 66l-3 8h26l-3-8" />
        <path d="M6 80h88l-4 10H10z" />
        <path d="M63 59.5h15M63 62.5h15" fill="none" strokeWidth="1.4" />
        <path d="M14 84h72M18 87h64" fill="none" strokeWidth="1.3" strokeDasharray="3 2.2" />
      </g>
      <circle cx="20" cy="60.5" r="1.9" fill="var(--red)" />
      <text x="50" y="42" textAnchor="middle" fill="var(--paper)" fontFamily="var(--serif)" fontWeight="700" fontSize="22">
        ??
      </text>
    </svg>
  );
}

// A king tipped on its side: how a chess player concedes. Uses the board's
// own piece artwork so it reads as a chess king at any size.
export function FallenKing({ size = 26 }) {
  return (
    <span className="fallen-king" style={{ width: size, height: size }} aria-hidden="true">
      <i className="pc king black" />
    </span>
  );
}

// A loose, hand-drawn ring for circling things in red pen.
export function PenCircle({ className = '' }) {
  return (
    <svg className={`pen-circle ${className}`} viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M54 6C30 4 7 13 5 30c-2 16 22 25 46 24 25-1 45-11 44-26C94 12 70 3 44 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
