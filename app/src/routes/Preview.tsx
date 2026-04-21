import { useRef } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

type PreviewNavState = { url: string }

export function Preview() {
  const navigate = useNavigate()
  const { state } = useLocation() as { state: PreviewNavState | null }
  const taps = useRef<number[]>([])

  // Refresh / deep link without a URL → start over.
  if (!state || typeof state.url !== 'string') {
    return <Navigate to="/quiz/1" replace />
  }

  const { url } = state

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
      position: 'fixed',
      inset: 0,
      background: '#000000',
    }}>
      {/* The generated site, loaded chrome-free. sandbox allows scripts/forms so the
          preview behaves as it would in a real browser; same-origin is off so the page
          can't touch our app's storage. */}
      <iframe
        src={url}
        title="Generated site preview"
        sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
      />

      {/* Invisible triple-tap exit zone, always on top of the iframe. */}
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
