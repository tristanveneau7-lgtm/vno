import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'

type Row = { label: string; state: 'locked' | 'on' | 'off' }

const ROWS: Row[] = [
  { label: 'Landing', state: 'locked' },
  { label: 'Gallery', state: 'on' },
  { label: 'Phone CTA', state: 'on' },
  { label: 'Booking', state: 'on' },
  { label: 'Pricing', state: 'off' },
  { label: 'About', state: 'off' },
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
    }}>
      <div style={{
        position: 'absolute',
        top: 2,
        left: on ? undefined : 2,
        right: on ? 2 : undefined,
        width: 14,
        height: 14,
        background: on ? '#0A0A0A' : '#555',
        borderRadius: '50%',
      }} />
    </div>
  )
}

export function Screen3Sections() {
  const navigate = useNavigate()
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
          const dim = row.state === 'off'
          return (
            <div key={row.label} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: tokens.surface,
              border: `0.5px solid ${tokens.border}`,
              borderRadius: tokens.radius.button,
              padding: '13px 14px',
            }}>
              <span style={{ fontSize: 14, color: dim ? '#888' : tokens.textPrimary }}>{row.label}</span>
              {row.state === 'locked'
                ? <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em' }}>LOCKED</span>
                : <Toggle on={row.state === 'on'} />}
            </div>
          )
        })}
      </div>
      <ContinueButton onClick={() => navigate('/quiz/4')} style={{ marginTop: 22 }} />
    </PhoneShell>
  )
}
