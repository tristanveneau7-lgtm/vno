import { useNavigate } from 'react-router-dom'
import type { CSSProperties, ReactNode } from 'react'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'
import { useQuiz, type Vibe } from '../lib/store'
import { useCanContinue } from '../lib/validation'

type Tile = {
  key: Vibe
  name: string
  descriptor: string
  thumb: CSSProperties
  thumbContent?: ReactNode
}

const TILES: Tile[] = [
  {
    key: 'editorial',
    name: 'Editorial',
    descriptor: 'Serif \u00b7 quiet \u00b7 magazine',
    thumb: { background: 'linear-gradient(135deg, #F8F4EE, #D8C4B4)' },
  },
  {
    key: 'modern',
    name: 'Modern',
    descriptor: 'Sans \u00b7 confident \u00b7 dark',
    thumb: { background: '#1A1F2E', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    thumbContent: <span style={{ fontSize: 11, fontWeight: 700, color: '#FAF9F5' }}>BOLD</span>,
  },
  {
    key: 'heritage',
    name: 'Heritage',
    descriptor: 'Warm \u00b7 crafted \u00b7 stamped',
    thumb: { background: 'linear-gradient(135deg, #EFE6D8, #C24E2C)' },
  },
]

export function Screen4Reference() {
  const navigate = useNavigate()
  const vibe = useQuiz((s) => s.vibe)
  const setVibe = useQuiz((s) => s.setVibe)
  const canContinue = useCanContinue(4)

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
        {TILES.map((t) => {
          const selected = vibe === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setVibe(t.key)}
              style={{
                background: selected ? '#1A1A1A' : tokens.surface,
                border: selected ? '1.5px solid #FFFFFF' : `0.5px solid ${tokens.border}`,
                borderRadius: tokens.radius.card,
                padding: 10,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                width: '100%',
                fontFamily: 'inherit',
                color: tokens.textPrimary,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 120ms ease-out, background 120ms ease-out',
              }}
            >
              <div style={{ width: 60, height: 60, borderRadius: 4, flexShrink: 0, ...t.thumb }}>
                {t.thumbContent}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{t.descriptor}</div>
              </div>
            </button>
          )
        })}
      </div>
      <ContinueButton
        onClick={() => navigate('/quiz/5')}
        disabled={!canContinue}
        style={{ marginTop: 22 }}
      />
    </PhoneShell>
  )
}
