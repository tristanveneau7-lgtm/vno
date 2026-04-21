import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'
import { useQuiz } from '../lib/store'
import { postBuild } from '../lib/api'

type RowStatus = 'done' | 'active' | 'pending'
type Row = { label: string; status: RowStatus; right?: string }

const ROWS: Row[] = [
  { label: 'Cloning the reference', status: 'done', right: 'done' },
  { label: 'Designing palette', status: 'done', right: 'done' },
  { label: 'Generating hero image', status: 'active', right: '12s' },
  { label: 'Writing copy', status: 'pending' },
  { label: 'Deploying to Netlify', status: 'pending' },
]

type Status = 'idle' | 'building' | 'error'

export function Screen7Build() {
  const navigate = useNavigate()
  const state = useQuiz()
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleBuild = async () => {
    if (status === 'building') return
    setStatus('building')
    setErrorMsg(null)
    try {
      const result = await postBuild({
        vertical: state.vertical,
        business: state.business,
        sections: state.sections,
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
          {ROWS.map((r) => (
            <div key={r.label} style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: r.status === 'pending' ? '#555' : tokens.textPrimary,
            }}>
              <span>{r.label}</span>
              <span style={{ color: '#888' }}>{r.right ?? ''}</span>
            </div>
          ))}
        </div>
        <div style={{
          height: 2,
          background: tokens.border,
          borderRadius: 1,
          marginTop: 14,
          overflow: 'hidden',
        }}>
          <div style={{ width: '45%', height: '100%', background: '#FFFFFF' }} />
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
