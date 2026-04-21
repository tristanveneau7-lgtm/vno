import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'

type Field = { label: string; value: string; optional?: boolean; dim?: boolean }

const FIELDS: Field[] = [
  { label: 'Business name', value: 'Maison Rose' },
  { label: 'Address', value: '228 Main St, Moncton' },
  { label: 'Phone', value: '(506) 555-0114' },
  { label: 'Hours', value: 'Wed\u2013Sat, 10 to 6' },
  { label: 'Slogan', value: 'A chair you return to.', optional: true, dim: true },
]

function FieldLabel({ text, optional }: { text: string; optional?: boolean }) {
  return (
    <div style={{
      fontSize: tokens.font.fieldLabel.size,
      color: tokens.font.fieldLabel.color,
      letterSpacing: tokens.font.fieldLabel.letterSpacing,
      textTransform: tokens.font.fieldLabel.textTransform,
      marginBottom: 5,
    }}>
      {text}
      {optional && <span style={{ color: '#555', textTransform: 'none', letterSpacing: 0 }}> &middot; optional</span>}
    </div>
  )
}

export function Screen2Business() {
  const navigate = useNavigate()
  return (
    <PhoneShell>
      <Header step="2 / 7" />
      <div style={{ fontSize: tokens.font.title.size, fontWeight: tokens.font.title.weight, letterSpacing: tokens.font.title.letterSpacing, margin: '0 0 4px' }}>
        Tell us about them
      </div>
      <p style={{ fontSize: tokens.font.subtitle.size, color: tokens.font.subtitle.color, margin: '0 0 20px' }}>
        The basics. Takes thirty seconds.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {FIELDS.map((f) => (
          <div key={f.label}>
            <FieldLabel text={f.label} optional={f.optional} />
            <div style={{
              background: tokens.surface,
              border: `0.5px solid ${tokens.border}`,
              borderRadius: tokens.radius.button,
              padding: '11px 12px',
              fontSize: 14,
              color: f.dim ? '#555' : tokens.textPrimary,
            }}>
              {f.value}
            </div>
          </div>
        ))}
      </div>
      <ContinueButton onClick={() => navigate('/quiz/3')} style={{ marginTop: 22 }} />
    </PhoneShell>
  )
}
