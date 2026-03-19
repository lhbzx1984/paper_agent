"use client";

const nodes = [
  { id: "topic", cx: 150, cy: 120, r: 18, rInner: 12, label: "主题", y: 155 },
  { id: "keyword", cx: 280, cy: 100, r: 22, rInner: 14, label: "关键词", y: 135 },
  { id: "innovation", cx: 400, cy: 80, r: 26, rInner: 16, label: "创新点", y: 115 },
  { id: "experiment", cx: 520, cy: 100, r: 22, rInner: 14, label: "实验", y: 135 },
  { id: "paper", cx: 650, cy: 120, r: 18, rInner: 12, label: "论文", y: 155 },
];

export function ResearchGraph() {
  return (
    <div className="relative w-full max-w-4xl">
      <svg
        viewBox="0 0 800 400"
        className="w-full h-auto opacity-90"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="nodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowStrong">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {Array.from({ length: 9 }).map((_, i) => (
          <line
            key={`h-${i}`}
            x1={0}
            y1={i * 50}
            x2={800}
            y2={i * 50}
            stroke="rgba(34,211,238,0.06)"
            strokeWidth="0.5"
          />
        ))}
        {Array.from({ length: 17 }).map((_, i) => (
          <line
            key={`v-${i}`}
            x1={i * 50}
            y1={0}
            x2={i * 50}
            y2={400}
            stroke="rgba(34,211,238,0.06)"
            strokeWidth="0.5"
          />
        ))}

        {/* Connection lines */}
        <line x1={150} y1={120} x2={280} y2={100} stroke="url(#lineGrad)" strokeWidth="1.5" strokeOpacity="0.6" />
        <line x1={280} y1={100} x2={400} y2={80} stroke="url(#lineGrad)" strokeWidth="1.5" strokeOpacity="0.6" />
        <line x1={400} y1={80} x2={520} y2={100} stroke="url(#lineGrad)" strokeWidth="1.5" strokeOpacity="0.6" />
        <line x1={520} y1={100} x2={650} y2={120} stroke="url(#lineGrad)" strokeWidth="1.5" strokeOpacity="0.6" />
        <line x1={280} y1={100} x2={300} y2={200} stroke="url(#lineGrad)" strokeWidth="1" strokeOpacity="0.4" />
        <line x1={400} y1={80} x2={400} y2={200} stroke="url(#lineGrad)" strokeWidth="1" strokeOpacity="0.4" />
        <line x1={520} y1={100} x2={500} y2={200} stroke="url(#lineGrad)" strokeWidth="1" strokeOpacity="0.4" />
        <line x1={300} y1={200} x2={500} y2={200} stroke="url(#lineGrad)" strokeWidth="1" strokeOpacity="0.3" />
        <line x1={400} y1={200} x2={400} y2={320} stroke="url(#lineGrad)" strokeWidth="1.5" strokeOpacity="0.5" />

        {/* Main nodes - interactive */}
        {nodes.map((node) => (
          <g
            key={node.id}
            className="research-graph-node"
            style={{ transformOrigin: `${node.cx}px ${node.cy}px` }}
          >
            <circle
              cx={node.cx}
              cy={node.cy}
              r={node.r + 12}
              fill="transparent"
            />
            <circle
              className="node-ring"
              cx={node.cx}
              cy={node.cy}
              r={node.r}
              fill="none"
              stroke="rgba(34,211,238,0.7)"
              strokeWidth="2"
              opacity="0"
              style={{ transformOrigin: `${node.cx}px ${node.cy}px` }}
            />
            <circle
              className="node-outer"
              cx={node.cx}
              cy={node.cy}
              r={node.r}
              fill="url(#nodeGrad)"
              filter="url(#glow)"
            />
            <circle
              className="node-inner"
              cx={node.cx}
              cy={node.cy}
              r={node.rInner}
              fill="none"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="1"
            />
            <text
              className="node-label"
              x={node.cx}
              y={node.y}
              fill="rgba(148,163,184,0.8)"
              fontSize={node.id === "innovation" ? 11 : 10}
              textAnchor="middle"
            >
              {node.label}
            </text>
          </g>
        ))}

        {/* Secondary nodes */}
        <circle cx={300} cy={200} r={10} fill="rgba(34,211,238,0.5)" />
        <circle cx={400} cy={200} r={12} fill="rgba(34,211,238,0.6)" />
        <circle cx={500} cy={200} r={10} fill="rgba(34,211,238,0.5)" />

        {/* RAG 知识库 node - interactive */}
        <g
          className="research-graph-node"
          style={{ transformOrigin: "400px 320px" }}
        >
          <circle cx={400} cy={320} r={34} fill="transparent" />
          <circle
            className="node-ring"
            cx={400}
            cy={320}
            r={20}
            fill="none"
            stroke="rgba(34,211,238,0.7)"
            strokeWidth="2"
            opacity="0"
            style={{ transformOrigin: "400px 320px" }}
          />
          <circle
            cx={400}
            cy={320}
            r={20}
            className="node-outer"
            fill="url(#nodeGrad)"
            filter="url(#glow)"
          />
          <circle
            cx={400}
            cy={320}
            r={12}
            fill="none"
            className="node-inner"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="1"
          />
          <text
            x={400}
            y={345}
            className="node-label"
            fill="rgba(34,211,238,0.9)"
            fontSize="12"
            textAnchor="middle"
            fontWeight="500"
          >
            RAG 知识库
          </text>
        </g>
      </svg>
    </div>
  );
}
