export function PaperOutline() {
  return (
    <svg
      viewBox="0 0 200 260"
      className="w-32 h-auto opacity-40"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="paperGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <rect
        x="10"
        y="10"
        width="180"
        height="240"
        rx="4"
        fill="none"
        stroke="url(#paperGrad)"
        strokeWidth="2"
      />
      <line x1="20" y1="40" x2="100" y2="40" stroke="url(#paperGrad)" strokeWidth="1" strokeOpacity="0.6" />
      <line x1="20" y1="60" x2="140" y2="60" stroke="url(#paperGrad)" strokeWidth="1" strokeOpacity="0.6" />
      <line x1="20" y1="80" x2="120" y2="80" stroke="url(#paperGrad)" strokeWidth="1" strokeOpacity="0.6" />
      <line x1="20" y1="110" x2="180" y2="110" stroke="url(#paperGrad)" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="20" y1="130" x2="170" y2="130" stroke="url(#paperGrad)" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="20" y1="150" x2="160" y2="150" stroke="url(#paperGrad)" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="20" y1="180" x2="180" y2="180" stroke="url(#paperGrad)" strokeWidth="1" strokeOpacity="0.3" />
      <line x1="20" y1="200" x2="150" y2="200" stroke="url(#paperGrad)" strokeWidth="1" strokeOpacity="0.3" />
      <line x1="20" y1="220" x2="170" y2="220" stroke="url(#paperGrad)" strokeWidth="1" strokeOpacity="0.3" />
    </svg>
  );
}
