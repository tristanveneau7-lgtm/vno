import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'
import { useQuiz, type Vertical } from '../lib/store'
import { useCanContinue } from '../lib/validation'

const VERTICALS: { key: Vertical; label: string }[] = [
  { key: 'tattoo', label: 'Tattoo' },
  { key: 'groomer', label: 'Groomer' },
  { key: 'barber', label: 'Barber' },
  { key: 'salon', label: 'Salon' },
  { key: 'trades', label: 'Trades' },
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'gym', label: 'Gym' },
  { key: 'health', label: 'Health' },
  { key: 'auto', label: 'Auto' },
  { key: 'daycare', label: 'Daycare' },
]

export function Screen1Vertical() {
  const navigate = useNavigate()
  const vertical = useQuiz((s) => s.vertical)
  const setVertical = useQuiz((s) => s.setVertical)
  const canContinue = useCanContinue(1)

  return (
    <PhoneShell>
      <Header step="1 / 7" />
      <div style={{ fontSize: tokens.font.title.size, fontWeight: tokens.font.title.weight, letterSpacing: tokens.font.title.letterSpacing, margin: '0 0 4px' }}>
        Pick the vertical
      </div>
      <p style={{ fontSize: tokens.font.subtitle.size, color: tokens.font.subtitle.color, margin: '0 0 20px' }}>
        Tap one. We&rsquo;ll filter from there.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {VERTICALS.map(({ key, label }) => {
          const selected = vertical === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setVertical(key)}
              style={{
                padding: '18px 12px',
                textAlign: 'center',
                fontSize: 14,
                borderRadius: tokens.radius.button,
                background: selected ? tokens.accent : tokens.surface,
                color: selected ? tokens.accentText : tokens.textPrimary,
                border: selected ? 'none' : `0.5px solid ${tokens.border}`,
                fontWeight: selected ? 500 : 400,
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'background 120ms ease-out, color 120ms ease-out',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
      <ContinueButton
        onClick={() => navigate('/quiz/2')}
        disabled={!canContinue}
        style={{ marginTop: 22 }}
      />
    </PhoneShell>
  )
}
