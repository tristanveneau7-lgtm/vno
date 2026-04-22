import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'
import { useQuiz } from '../lib/store'
import { postBuild } from '../lib/api'

// Phase 4 builds take ~60-180s end-to-end. The engine doesn't emit granular
// progress, so the UI walks this list every 30s as visual reassurance that
// work is happening. Phase 5 can wire real SSE/polling progress if needed.
const PROGRESS_LABELS = [
  'Cloning the reference\u2026',
  'Injecting business info\u2026',
  'Generating HTML\u2026',
  'Deploying to Netlify\u2026',
  'Almost done\u2026',
]
const PROGRESS_TICK_MS = 30_000

type Status = 'idle' | 'building' | 'error'

export function Screen7Build() {
  const navigate = useNavigate()
  const state = useQuiz()
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [progressIdx, setProgressIdx] = useState(0)

  // Drive the rotating progress copy. Reset to 0 on every status change so a
  // retry after error starts fresh; freeze at the last index when error so the
  // phase that broke stays visible underneath the red error line.
  useEffect(() => {
    if (status !== 'building') return
    setProgressIdx(0)
    const id = setInterval(() => {
      setProgressIdx((i) => Math.min(i + 1, PROGRESS_LABELS.length - 1))
    }, PROGRESS_TICK_MS)
    return () => clearInterval(id)
  }, [status])

  const handleBuild = async () => {
    if (status === 'building') return
    setStatus('building')
    setErrorMsg(null)
    try {
      const result = await postBuild({
        vertical: state.vertical,
        business: state.business,
        sections: state.sections,
        reference: state.reference,
        vibe: state.vibe,
        assets: state.assets,
        anythingSpecial: state.anythingSpecial,
      })
      navigate('/review', {
        state: { url: result.url, buildTime: result.buildTime, requestId: result.requestId },
      })
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const label = status === 'building' ? 'Building\u2026' : status === 'error' ? 'Try again' : 'Build the site \u2192'
  const showProgress = status === 'building' || status === 'error'
  const barPct = showProgress ? ((progressIdx + 1) / PROGRESS_LABELS.length) * 100 : 0

  return (
    <PhoneShell>
      <Header step="7 / 7" marginBottom={32} />
      <div style={{ textAlign: 'center', padding: '18px 0 24px' }}>
        <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em', marginBottom: 6 }}>
          Ready to build
        </div>
        <p style={{ fontSize: 12, color: '#888', margin: 0 }}>About six minutes.</p>
      </div>

      <ContinueButton
        onClick={handleBuild}
        disabled={status === 'building'}
        padding="18px"
        fontSize="15px"
        radius={tokens.radius.card}
        style={{ marginBottom: 24, opacity: status === 'building' ? 0.5 : 1 }}
      >
        {label}
      </ContinueButton>

      <div style={{
        background: tokens.surface,
        border: `0.5px solid ${tokens.border}`,
        borderRadius: tokens.radius.card,
        padding: 14,
      }}>
        <div style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          color: '#555',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}>
          Building &middot; preview
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
          {PROGRESS_LABELS.map((labelText, i) => {
            // Idle: everything dim. Building/error: walked-through phases bright,
            // current phase bright, future phases dim.
            const isActiveOrPast = showProgress && i <= progressIdx
            return (
              <div key={labelText} style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: isActiveOrPast ? tokens.textPrimary : '#555',
                transition: 'color 200ms ease-out',
              }}>
                <span>{labelText}</span>
              </div>
            )
          })}
        </div>
        <div style={{
          height: 2,
          background: tokens.border,
          borderRadius: 1,
          marginTop: 14,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${barPct}%`,
            height: '100%',
            background: '#FFFFFF',
            transition: 'width 400ms ease-out',
          }} />
        </div>
      </div>

      {status === 'error' && errorMsg && (
        <div style={{
          marginTop: 12,
          fontSize: 12,
          color: '#E26D6D',
          lineHeight: 1.4,
        }}>
          {errorMsg}
        </div>
      )}
    </PhoneShell>
  )
}
