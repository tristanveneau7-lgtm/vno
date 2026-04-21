import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'

const VERTICALS = [
  'Tattoo', 'Groomer',
  'Barber', 'Salon',
  'Trades', 'Restaurant',
  'Gym', 'Health',
  'Auto', 'Daycare',
]
const SELECTED = 'Salon'

export function Screen1Vertical() {
  const navigate = useNavigate()
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
        {VERTICALS.map((label) => {
          const selected = label === SELECTED
          return (
            <div
              key={label}
              style={{
                padding: '18px 12px',
                textAlign: 'center',
                fontSize: 14,
                borderRadius: tokens.radius.button,
                background: selected ? tokens.accent : tokens.surface,
                color: selected ? tokens.accentText : tokens.textPrimary,
                border: selected ? 'none' : `0.5px solid ${tokens.border}`,
                fontWeight: selected ? 500 : 400,
              }}
            >
              {label}
            </div>
          )
        })}
      </div>
      <ContinueButton onClick={() => navigate('/quiz/2')} style={{ marginTop: 22 }} />
    </PhoneShell>
  )
}
