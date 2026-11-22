import './decor.css'
import { useEffect, useState } from 'react'
import { isMuted, setMuted, unlockAudio, playSkip } from './sounds'

const SPINES = ['#7a2e3a', '#2f5d3a', '#c98a2b', '#3b4f7a', '#8a5a33', '#5a2f6b', '#a8442e', '#2c6b6b']
// A repeatable "random" number, so the shelves look the same on every visit
const rnd = (n) => Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1

// One side of the room: a moonlit arched window, a wall candle, and a tall bookshelf
function Wall({ side }) {
  const items = []
  for (let row = 0; row < 8; row++) {
    const top = 240 + row * 62
    let x = 6
    let i = 0
    while (x < 112) {
      const seed = row * 31 + i + (side === 'right' ? 500 : 0)
      const w = 6 + Math.floor(rnd(seed) * 6)
      const h = 30 + Math.floor(rnd(seed + 7) * 22)
      const color = SPINES[Math.floor(rnd(seed + 3) * SPINES.length)]
      items.push(<rect key={`b${row}-${i}`} x={x} y={top + 56 - h} width={w} height={h} fill={color} />)
      items.push(<rect key={`s${row}-${i}`} x={x} y={top + 56 - h} width={2} height={h} fill="#000" opacity="0.25" />)
      x += w + 1
      i++
    }
    items.push(<rect key={`p${row}`} x={0} y={top + 56} width={120} height={6} fill="#4a2f1c" />)
  }
  // A stepped arch, built from rows of rectangles so it looks pixelated
  const arch = (r, fill, prefix) => {
    const out = []
    for (let y = 80 - r; y < 80; y += 4) {
      const hw = Math.round(Math.sqrt(r * r - (80 - y - 2) ** 2))
      out.push(<rect key={`${prefix}${y}`} x={60 - hw} y={y} width={hw * 2} height={4} fill={fill} />)
    }
    return out
  }
  const stars = [[40, 70], [52, 52], [76, 88], [84, 60], [46, 112], [72, 130]]
  const glow = `glow-${side}`
  return (
    <div className={`side ${side}`}>
      <svg viewBox="0 0 120 740" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
        <defs>
          <radialGradient id={glow}>
            <stop offset="0" stopColor="#f2b134" stopOpacity="0.55" />
            <stop offset="1" stopColor="#f2b134" stopOpacity="0" />
          </radialGradient>
        </defs>
        {arch(40, '#6b5a48', 'f')}
        <rect x={20} y={80} width={80} height={130} fill="#6b5a48" />
        {arch(34, '#15233f', 'k')}
        <rect x={26} y={80} width={68} height={124} fill="#15233f" />
        {stars.map(([sx, sy], k) => (
          <rect key={k} className="twinkle" style={{ animationDelay: `${k * 0.4}s` }} x={sx} y={sy} width={2} height={2} fill="#f1e2bd" />
        ))}
        <rect x={80} y={100} width={8} height={8} fill="#f1e2bd" />
        <rect x={84} y={100} width={4} height={8} fill="#15233f" />
        <rect x={58} y={46} width={4} height={158} fill="#6b5a48" />
        <rect x={26} y={118} width={68} height={4} fill="#6b5a48" />
        <rect x={16} y={206} width={88} height={8} fill="#4b3d30" />
        <circle className="glow" cx={60} cy={226} r={26} fill={`url(#${glow})`} />
        <rect x={52} y={232} width={16} height={4} fill="#8a6b2a" />
        <rect x={57} y={222} width={6} height={10} fill="#f1e2bd" />
        <rect className="flame" x={58} y={216} width={4} height={6} fill="#f2b134" />
        <rect className="flame" x={59} y={214} width={2} height={3} fill="#fff3c4" />
        {items}
        {side === 'left' && (
          <g fill="#8a5a33">
            <rect x={96} y={236} width={3} height={470} />
            <rect x={110} y={236} width={3} height={470} />
            {Array.from({ length: 20 }, (_, r) => <rect key={r} x={96} y={246 + r * 23} width={17} height={3} />)}
          </g>
        )}
      </svg>
    </div>
  )
}

export default function Decor() {
  const [muted, setMutedState] = useState(isMuted())

  // Browsers only allow sound after you touch the page once, so get ready on the first tap or key press.
  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio, { once: true })
    window.addEventListener('keydown', unlockAudio, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [])

  function toggle() {
    const next = !muted
    setMuted(next)
    setMutedState(next)
    if (!next) playSkip()
  }

  return (
    <>
      <div className="decor" aria-hidden="true">
        <Wall side="left" />
        <Wall side="right" />
        {Array.from({ length: 16 }, (_, i) => (
          <span
            key={i}
            className="mote"
            style={{ left: `${rnd(i + 1) * 100}%`, animationDuration: `${16 + rnd(i + 9) * 16}s`, animationDelay: `-${rnd(i + 4) * 24}s` }}
          />
        ))}
      </div>
      <button className="sound ghost" onClick={toggle} aria-pressed={muted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>
        {muted ? 'SOUND OFF' : 'SOUND ON'}
      </button>
    </>
  )
}
