import { useNavigate } from 'react-router-dom'
import type { CSSProperties, ReactNode } from 'react'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'

type Tile = {
  name: string
  descriptor: string
  thumb: CSSProperties
  thumbContent?: ReactNode
  selected?: boolean
}

const TILES: Tile[] = [
  {
    name: 'Editorial',
    descriptor: 'Serif \u00b7 quiet \u00b7 magazine',
    thumb: { background: 'linear-gradient(135deg, #F8F4EE, #D8C4B4)' },
  },
  {
    name: 'Modern',
    descriptor: 'Sans \u00b7 confident \u00b7 dark',
    thumb: { background: '#1A1F2E', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    thumbContent: <span style={{ fontSize: 11, fontWeight: 700, color: '#FAF9F5' }}>BOLD</span>,
    selected: true,
  },
  {
    name: 'Heritage',
    descriptor: 'Warm \u00b7 crafted \u00b7 stamped',
    thumb: { background: 'linear-gradient(135deg, #EFE6D8, #C24E2C)' },
  },
]

export function Screen4Reference() {
  const navigate = useNavigate()
  return (
    <PhoneShell>
      <Header step="4 / 7" />
      <div style={{ fontSize: tokens.font.title.size, fontWeight: tokens.font.title.weight, letterSpacing: tokens.font.title.letterSpacing, margin: '0 0 4px' }}>
        Pick the vibe
      </div>
      <p style={{ fontSize: tokens.font.subtitle.size, color: tokens.font.subtitle.color, margin: '0 0 18px' }}>
        Three references for Maison Rose. Tap one.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TILES.map((t) => (
          <div key={t.name} style={{
            background: t.selected ? '#1A1A1A' : tokens.surface,
            border: t.selected ? '1.5px solid #FFFFFF' : `0.5px solid ${tokens.border}`,
            borderRadius: tokens.radius.card,
            padding: 10,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}>
            <div style={{ width: 60, height: 60, borderRadius: 4, flexShrink: 0, ...t.thumb }}>
              {t.thumbContent}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{t.descriptor}</div>
            </div>
          </div>
        ))}
      </div>
      <ContinueButton onClick={() => navigate('/quiz/5')} style={{ marginTop: 22 }} />
    </PhoneShell>
  )
}
