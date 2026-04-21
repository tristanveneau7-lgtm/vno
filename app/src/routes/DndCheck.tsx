import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { tokens } from '../lib/tokens'

export function DndCheck() {
  const navigate = useNavigate()
  const [checked, setChecked] = useState(false)

  const onButton = () => {
    if (!checked) {
      setChecked(true)
      return
    }
    navigate('/preview')
  }

  return (
    <PhoneShell>
      <div style={{ textAlign: 'center', padding: '32px 8px 24px' }}>
        <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em', marginBottom: 8 }}>
          One last thing
        </div>
        <p style={{ fontSize: 13, color: '#888', margin: 0, lineHeight: 1.5 }}>
          Silence the phone before handing over.<br />
          Notifications kill the moment.
        </p>
      </div>

      <div
        onClick={() => setChecked((c) => !c)}
        style={{
          background: tokens.surface,
          border: `0.5px solid ${tokens.border}`,
          borderRadius: tokens.radius.card,
          padding: '14px 16px',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: 22,
          height: 22,
          border: '1.5px solid #FFFFFF',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {checked && <span style={{ fontSize: 14, lineHeight: 1, color: '#FFFFFF' }}>&#10003;</span>}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Do Not Disturb is on</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Swipe from top-right to toggle</div>
        </div>
      </div>

      <button
        type="button"
        onClick={onButton}
        style={{
          width: '100%',
          padding: 14,
          background: tokens.accent,
          color: tokens.accentText,
          border: 'none',
          borderRadius: tokens.radius.button,
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 500,
          fontFamily: 'inherit',
          cursor: 'pointer',
          opacity: checked ? 1 : 0.4,
          marginBottom: 8,
        }}
      >
        Enter Preview Mode
      </button>

      <div style={{ textAlign: 'center', fontSize: 11, color: '#555', marginTop: 8 }}>
        Triple-tap top corner to exit later
      </div>
    </PhoneShell>
  )
}
