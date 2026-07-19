'use client'

interface ScoreProgressProps {
  score: number
  size?: number
}

export function ScoreProgress({ score, size = 42 }: ScoreProgressProps) {
  const r = (size / 2) - 3
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference
  const color = score < 70 ? '#ef4444' : score < 85 ? '#f59e0b' : '#22c55e'
  const bgColor = score < 70 ? 'rgba(239,68,68,.15)' : score < 85 ? 'rgba(245,158,11,.15)' : 'rgba(34,197,94,.15)'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: 'none' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bgColor} strokeWidth="3" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .8s ease' }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={size * 0.32}
        fontFamily="var(--font-status)"
        fontWeight="700"
      >
        {score}
      </text>
    </svg>
  )
}
