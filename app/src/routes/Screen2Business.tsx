import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'
import { useQuiz, type BusinessInfo } from '../lib/store'
import { useCanContinue } from '../lib/validation'

type Field = {
  key: keyof BusinessInfo
  label: string
  type: 'text' | 'tel'
  optional?: boolean
  autoComplete?: string
}

const FIELDS: Field[] = [
  { key: 'name', label: 'Business name', type: 'text', autoComplete: 'organization' },
  { key: 'address', label: 'Address', type: 'text', autoComplete: 'street-address' },
  { key: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel' },
  { key: 'hours', label: 'Hours', type: 'text' },
  { key: 'slogan', label: 'Slogan', type: 'text', optional: true },
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
  const business = useQuiz((s) => s.business)
  const setBusiness = useQuiz((s) => s.setBusiness)
  const canContinue = useCanContinue(2)

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
          <div key={f.key}>
            <FieldLabel text={f.label} optional={f.optional} />
            <input
              className="vno-input"
              type={f.type}
              inputMode={f.type === 'tel' ? 'tel' : undefined}
              autoComplete={f.autoComplete}
              autoCapitalize={f.key === 'phone' ? 'off' : 'sentences'}
              value={business[f.key]}
              onChange={(e) => setBusiness({ [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <ContinueButton
        onClick={() => navigate('/quiz/3')}
        disabled={!canContinue}
        style={{ marginTop: 22 }}
      />
    </PhoneShell>
  )
}
