import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'

export function Screen6Special() {
  const navigate = useNavigate()
  const go = () => navigate('/quiz/7')
  return (
    <PhoneShell>
      <Header step="6 / 7" />
      <div style={{ fontSize: tokens.font.title.size, fontWeight: tokens.font.title.weight, letterSpacing: tokens.font.title.letterSpacing, margin: '0 0 4px' }}>
        Anything special?
      </div>
      <p style={{ fontSize: tokens.font.subtitle.size, color: tokens.font.subtitle.color, margin: '0 0 18px' }}>
        One thing about them. Or skip.
      </p>
      <div style={{
        background: tokens.surface,
        border: `0.5px solid ${tokens.border}`,
        borderRadius: tokens.radius.button,
        padding: 14,
        minHeight: 130,
        fontSize: 13,
        color: '#555',
        lineHeight: 1.5,
      }}>
        e.g. 30 years in business, 2nd-gen owner, only female-owned barber on the block&hellip;
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
        <ContinueButton variant="secondary" onClick={go}>Skip</ContinueButton>
        <ContinueButton onClick={go}>Continue</ContinueButton>
      </div>
    </PhoneShell>
  )
}
