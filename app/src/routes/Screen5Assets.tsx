import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'

export function Screen5Assets() {
  const navigate = useNavigate()
  return (
    <PhoneShell>
      <Header step="5 / 7" />
      <div style={{ fontSize: tokens.font.title.size, fontWeight: tokens.font.title.weight, letterSpacing: tokens.font.title.letterSpacing, margin: '0 0 4px' }}>
        Upload assets
      </div>
      <p style={{ fontSize: tokens.font.subtitle.size, color: tokens.font.subtitle.color, margin: '0 0 18px' }}>
        Logo first. Storefront photos optional.
      </p>

      <div style={{
        background: tokens.surface,
        border: '0.5px dashed #333',
        borderRadius: tokens.radius.card,
        padding: 24,
        textAlign: 'center',
        marginBottom: 14,
      }}>
        <div style={{
          width: 64,
          height: 64,
          margin: '0 auto 10px',
          background: '#FFF',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: tokens.accentText,
          fontWeight: 500,
        }}>
          LOGO
        </div>
        <div style={{ fontSize: 12, color: '#888' }}>Logo uploaded &middot; tap to replace</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
        {['PHOTO 1', 'PHOTO 2'].map((label) => (
          <div key={label} style={{
            background: tokens.surface,
            border: '0.5px dashed #333',
            borderRadius: tokens.radius.card,
            padding: 22,
            textAlign: 'center',
            fontSize: 22,
            color: '#555',
            lineHeight: 1,
          }}>
            +
            <div style={{ fontSize: 10, marginTop: 6, letterSpacing: '0.08em', color: '#555' }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {['Camera', 'Library'].map((label) => (
          <div key={label} style={{
            flex: 1,
            padding: 10,
            background: tokens.surface,
            border: `0.5px solid ${tokens.border}`,
            borderRadius: tokens.radius.button,
            textAlign: 'center',
            fontSize: 12,
          }}>
            {label}
          </div>
        ))}
      </div>

      <ContinueButton onClick={() => navigate('/quiz/6')} />
    </PhoneShell>
  )
}
