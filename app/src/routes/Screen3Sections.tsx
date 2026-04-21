import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'
import { useQuiz, type Sections } from '../lib/store'

type ToggleKey = keyof Omit<Sections, 'landing'>
type Row = { label: string; key: ToggleKey | 'landing' }

const ROWS: Row[] = [
  { label: 'Landing', key: 'landing' },
  { label: 'Gallery', key: 'gallery' },
  { label: 'Phone CTA', key: 'phoneCta' },
  { label: 'Booking', key: 'booking' },
  { label: 'Pricing', key: 'pricing' },
  { label: 'About', key: 'about' },
]

function Toggle({ on }: { on: boolean }) {
  return (
    <div style={{
      width: 32,
      height: 18,
      background: on ? '#FFFFFF' : '#2A2A2A',
      borderRadius: 9,
      position: 'relative',
      flexShrink: 0,
      transition: 'background-color 120ms ease-out',
    }}>
      <div style={{
        position: 'absolute',
        top: 2,
        left: 2,
        width: 14,
        height: 14,
        background: on ? '#0A0A0A' : '#555',
        borderRadius: '50%',
        transform: on ? 'translateX(14px)' : 'translateX(0)',
        transition: 'transform 120ms ease-out, background-color 120ms ease-out',
      }} />
    </div>
  )
}

export function Screen3Sections() {
  const navigate = useNavigate()
  const sections = useQuiz((s) => s.sections)
  const toggleSection = useQuiz((s) => s.toggleSection)

  return (
    <PhoneShell>
      <Header step="3 / 7" />
      <div style={{ fontSize: tokens.font.title.size, fontWeight: tokens.font.title.weight, letterSpacing: tokens.font.title.letterSpacing, margin: '0 0 4px' }}>
        Pick the sections
      </div>
      <p style={{ fontSize: tokens.font.subtitle.size, color: tokens.font.subtitle.color, margin: '0 0 20px' }}>
        Landing is always on. Tap any others.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ROWS.map((row) => {
          const isLanding = row.key === 'landing'
          const on = isLanding ? true : sections[row.key as ToggleKey]
          const dim = !isLanding && !on
          return (
            <button
              key={row.key}
              type="button"
              disabled={isLanding}
              onClick={isLanding ? undefined : () => toggleSection(row.key as ToggleKey)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: tokens.surface,
                border: `0.5px solid ${tokens.border}`,
                borderRadius: tokens.radius.button,
                padding: '13px 14px',
                width: '100%',
                fontFamily: 'inherit',
                cursor: isLanding ? 'default' : 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 14, color: dim ? '#888' : tokens.textPrimary }}>{row.label}</span>
              {isLanding
                ? <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em' }}>LOCKED</span>
                : <Toggle on={on} />}
            </button>
          )
        })}
      </div>
      <ContinueButton onClick={() => navigate('/quiz/4')} style={{ marginTop: 22 }} />
    </PhoneShell>
  )
}
