import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const SERIF = '"Times New Roman", serif'

export function Preview() {
  const navigate = useNavigate()
  const taps = useRef<number[]>([])

  const onExitTap = () => {
    const now = Date.now()
    taps.current = [...taps.current, now].filter((t) => now - t <= 1000)
    if (taps.current.length >= 3) {
      taps.current = []
      navigate('/quiz/1')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8F4EE',
      color: '#2A2119',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      <div style={{
        padding: '14px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '0.5px solid rgba(0,0,0,0.06)',
      }}>
        <span style={{ fontFamily: SERIF, fontSize: 15, fontStyle: 'italic', color: '#2A2119' }}>Maison Rose</span>
        <span style={{ fontSize: 11, letterSpacing: '0.1em', color: '#2A2119' }}>MENU</span>
      </div>

      <div style={{ padding: '42px 22px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.2em', color: '#9A7F6A', margin: '0 0 18px' }}>
          &mdash; MONCTON EST. 2019 &mdash;
        </p>
        <h1 style={{
          fontFamily: SERIF,
          fontSize: 48,
          lineHeight: 0.95,
          letterSpacing: '-0.02em',
          color: '#2A2119',
          margin: 0,
          fontWeight: 400,
        }}>
          A chair<br />
          <em style={{ color: '#9A7F6A' }}>you</em><br />
          return<br />
          to.
        </h1>
      </div>

      <div style={{ padding: '0 22px 20px', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 1, paddingBottom: 4 }}>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: '#5C4E42', margin: 0 }}>
            Color, cut, and a slow morning. Walk-ins welcome Wednesday through Saturday.
          </p>
        </div>
        <div style={{ width: 100, height: 124, background: '#D8C4B4', borderRadius: 2 }} />
      </div>

      <div style={{ padding: '0 22px 28px', display: 'flex', gap: 8 }}>
        <div style={{
          flex: 1,
          padding: '13px 12px',
          background: '#2A2119',
          color: '#F8F4EE',
          fontSize: 12,
          textAlign: 'center',
          letterSpacing: '0.04em',
        }}>
          Book a chair
        </div>
        <div style={{
          padding: '13px 14px',
          border: '0.5px solid #2A2119',
          color: '#2A2119',
          fontSize: 12,
          letterSpacing: '0.04em',
        }}>
          Call
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{
        padding: '14px 18px',
        background: '#2A2119',
        color: '#F8F4EE',
        fontSize: 11,
        textAlign: 'center',
        borderTop: '0.5px solid rgba(0,0,0,0.1)',
      }}>
        Plus 3 social posts &middot; review cards &middot; desk sign &mdash; all included
      </div>

      <div
        onClick={onExitTap}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 60,
          height: 60,
          zIndex: 10,
          background: 'transparent',
          cursor: 'default',
        }}
      />
    </div>
  )
}
