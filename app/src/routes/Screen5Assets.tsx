import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'
import { useQuiz } from '../lib/store'
import { useCanContinue } from '../lib/validation'

type Target = 'logo' | 'photo1' | 'photo2'

export function Screen5Assets() {
  const navigate = useNavigate()
  const { logo: logoDataUrl, photo1: photo1DataUrl, photo2: photo2DataUrl } = useQuiz((s) => s.assets)
  const setLogo = useQuiz((s) => s.setLogo)
  const setPhoto = useQuiz((s) => s.setPhoto)
  const canContinue = useCanContinue(5)

  const fileInput = useRef<HTMLInputElement>(null)
  const target = useRef<Target>('logo')

  const pick = (t: Target) => {
    target.current = t
    if (fileInput.current) {
      fileInput.current.value = ''
      fileInput.current.click()
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      if (target.current === 'logo') setLogo(dataUrl)
      else if (target.current === 'photo1') setPhoto(1, dataUrl)
      else setPhoto(2, dataUrl)
    }
    reader.readAsDataURL(file)
  }

  return (
    <PhoneShell>
      <Header step="5 / 7" />
      <div style={{ fontSize: tokens.font.title.size, fontWeight: tokens.font.title.weight, letterSpacing: tokens.font.title.letterSpacing, margin: '0 0 4px' }}>
        Upload assets
      </div>
      <p style={{ fontSize: tokens.font.subtitle.size, color: tokens.font.subtitle.color, margin: '0 0 18px' }}>
        Logo, hero photo, and one more — all three required.
      </p>

      <button
        type="button"
        onClick={() => pick('logo')}
        style={{
          background: tokens.surface,
          border: '0.5px dashed #333',
          borderRadius: tokens.radius.card,
          padding: 24,
          textAlign: 'center',
          marginBottom: 14,
          width: '100%',
          fontFamily: 'inherit',
          color: tokens.textPrimary,
          cursor: 'pointer',
        }}
      >
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
          overflow: 'hidden',
        }}>
          {logoDataUrl
            ? <img src={logoDataUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : 'LOGO'}
        </div>
        <div style={{ fontSize: 12, color: '#888' }}>
          {logoDataUrl ? 'Logo uploaded \u00b7 tap to replace' : 'Tap to upload'}
        </div>
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
        {([1, 2] as const).map((slot) => {
          const dataUrl = slot === 1 ? photo1DataUrl : photo2DataUrl
          return (
            <button
              key={slot}
              type="button"
              onClick={() => pick(`photo${slot}` as Target)}
              style={{
                background: tokens.surface,
                border: '0.5px dashed #333',
                borderRadius: tokens.radius.card,
                padding: dataUrl ? 0 : 22,
                textAlign: 'center',
                fontSize: 22,
                color: '#555',
                lineHeight: 1,
                fontFamily: 'inherit',
                cursor: 'pointer',
                minHeight: 82,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {dataUrl
                ? <img src={dataUrl} alt={`Photo ${slot}`} style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: tokens.radius.card,
                  }} />
                : <>
                    +
                    <div style={{ fontSize: 10, marginTop: 6, letterSpacing: '0.08em', color: '#555' }}>
                      {slot === 1 ? 'HERO' : 'SECONDARY'}
                    </div>
                  </>}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {(['Camera', 'Library'] as const).map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => pick(target.current)}
            style={{
              flex: 1,
              padding: 10,
              background: tokens.surface,
              border: `0.5px solid ${tokens.border}`,
              borderRadius: tokens.radius.button,
              textAlign: 'center',
              fontSize: 12,
              color: tokens.textPrimary,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        style={{ display: 'none' }}
      />

      <ContinueButton onClick={() => navigate('/quiz/6')} disabled={!canContinue} />
    </PhoneShell>
  )
}
