import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'
import { useQuiz } from '../lib/store'

const SERIF = '"Times New Roman", serif'

export function Review() {
  const navigate = useNavigate()
  const name = useQuiz((s) => s.business.name).trim() || 'Your business'
  return (
    <PhoneShell>
      <Header step="ready" marginBottom={18} rightColor="#888" />
      <div style={{ fontSize: tokens.font.title.size, fontWeight: tokens.font.title.weight, letterSpacing: tokens.font.title.letterSpacing, margin: '0 0 4px' }}>
        {name}
      </div>
      <p style={{ fontSize: 12, color: '#888', margin: '0 0 18px' }}>Built in 5m 42s. Looks good?</p>

      <div style={{
        background: tokens.surface,
        border: `0.5px solid ${tokens.border}`,
        borderRadius: tokens.radius.card,
        padding: 10,
        marginBottom: 14,
      }}>
        <div style={{
          background: '#F8F4EE',
          borderRadius: 4,
          padding: '14px 10px',
          minHeight: 130,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#2A2119',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 9, letterSpacing: '0.2em', color: '#9A7F6A', marginBottom: 6 }}>
            &mdash; MONCTON EST. 2019 &mdash;
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 0.95, fontWeight: 400 }}>
            A chair<br />
            <span style={{ fontStyle: 'italic', color: '#9A7F6A' }}>you</span><br />
            return to.
          </div>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 8,
          fontSize: 11,
          color: '#888',
        }}>
          <span>maison-rose-7a3f.netlify.app</span>
          <span style={{ color: '#666' }}>tap to expand</span>
        </div>
      </div>

      <ContinueButton
        onClick={() => navigate('/dnd')}
        padding="14px"
        fontSize="14px"
        style={{ marginBottom: 8 }}
      >
        Hand to client &rarr;
      </ContinueButton>
      <div style={{ display: 'flex', gap: 8 }}>
        <ContinueButton variant="secondary" padding="11px" fontSize="12px" onClick={() => navigate('/quiz/1')}>
          Re-clone
        </ContinueButton>
        <ContinueButton variant="secondary" padding="11px" fontSize="12px" onClick={() => navigate('/quiz/1')}>
          Edit inputs
        </ContinueButton>
      </div>
    </PhoneShell>
  )
}
