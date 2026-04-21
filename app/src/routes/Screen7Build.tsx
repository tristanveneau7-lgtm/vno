import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'

type Status = 'done' | 'active' | 'pending'
type Row = { label: string; status: Status; right?: string }

const ROWS: Row[] = [
  { label: 'Cloning the reference', status: 'done', right: 'done' },
  { label: 'Designing palette', status: 'done', right: 'done' },
  { label: 'Generating hero image', status: 'active', right: '12s' },
  { label: 'Writing copy', status: 'pending' },
  { label: 'Deploying to Netlify', status: 'pending' },
]

export function Screen7Build() {
  const navigate = useNavigate()
  const [building, setBuilding] = useState(false)

  const onBuild = () => {
    if (building) return
    setBuilding(true)
    setTimeout(() => navigate('/review'), 2000)
  }

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
        onClick={onBuild}
        disabled={building}
        padding="18px"
        fontSize="15px"
        radius={tokens.radius.card}
        style={{ marginBottom: 24, opacity: building ? 0.5 : 1 }}
      >
        {building ? 'Building\u2026' : 'Build the site \u2192'}
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
    </PhoneShell>
  )
}
