import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'
import { useQuiz } from '../lib/store'
import { useCanContinue } from '../lib/validation'
import { extractLogoColor } from '../lib/extractLogoColor'

type Target = 'logo' | 'photo1' | 'photo2'
type BrandColorMode = 'logo' | 'custom' | null

export function Screen5Assets() {
  const navigate = useNavigate()
  const {
    logo: logoDataUrl,
    photo1: photo1DataUrl,
    photo2: photo2DataUrl,
    photo1Orientation,
    photo2Orientation,
    brandColor,
  } = useQuiz((s) => s.assets)
  const setLogo = useQuiz((s) => s.setLogo)
  const setPhoto = useQuiz((s) => s.setPhoto)
  const setPhotoOrientation = useQuiz((s) => s.setPhotoOrientation)
  const setBrandColor = useQuiz((s) => s.setBrandColor)
  const canContinue = useCanContinue(5)

  const fileInput = useRef<HTMLInputElement>(null)
  const target = useRef<Target>('logo')
  const colorInput = useRef<HTMLInputElement>(null)
  // Which method last populated brandColor. Tracked locally (useState) because
  // we can't recover the origin from the hex alone, and the active-toggle
  // styling needs it. Transient UI flag — not persisted, not in the store.
  const [brandColorMode, setBrandColorMode] = useState<BrandColorMode>(null)
  // Previous logoDataUrl, held in a ref so the effect below can detect real
  // logo changes without firing on unrelated re-renders (e.g. when
  // brandColorMode transitions to 'logo' as part of the extraction flow).
  const prevLogoRef = useRef<string | null>(logoDataUrl)

  // If the user swaps logos after having extracted a logo-derived brand
  // color, invalidate the stale hex and force a re-tap of "From my logo".
  // Custom picks are preserved — they don't depend on the logo. Mirrors the
  // setPhoto → clear-orientation pattern in the store: a new upload
  // invalidates the prior assumption about the asset.
  useEffect(() => {
    if (prevLogoRef.current === logoDataUrl) return
    prevLogoRef.current = logoDataUrl
    if (brandColorMode === 'logo') {
      setBrandColor('')
      setBrandColorMode(null)
    }
  }, [logoDataUrl, brandColorMode, setBrandColor])

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

  // Re-runnable by design: every tap re-extracts from the current logo.
  // Swapping the logo invalidates a prior logo-derived brandColor via the
  // useEffect above, so the user is forced back into an explicit re-tap.
  const pickLogoColor = async () => {
    if (!logoDataUrl) return
    try {
      const hex = await extractLogoColor(logoDataUrl)
      setBrandColor(hex)
      setBrandColorMode('logo')
    } catch (err) {
      // Swallow: we don't want a mid-demo error dialog for a color heuristic.
      // The user can fall back to "Pick custom".
      console.warn('logo color extraction failed', err)
    }
  }

  const pickCustomColor = () => {
    colorInput.current?.click()
  }

  return (
    <PhoneShell>
      <Header step="5 / 7" />
      <div style={{ fontSize: tokens.font.title.size, fontWeight: tokens.font.title.weight, letterSpacing: tokens.font.title.letterSpacing, margin: '0 0 4px' }}>
        Upload assets
      </div>
      <p style={{ fontSize: tokens.font.subtitle.size, color: tokens.font.subtitle.color, margin: '0 0 18px' }}>
        Logo + two photos. Tap each photo's orientation so the layout places it right.
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
          const orientation = slot === 1 ? photo1Orientation : photo2Orientation
          return (
            <div key={slot} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
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
              {/*
                Orientation toggle — disabled until a photo is uploaded because
                tagging orientation without a photo has no meaning. Selected
                state flips to the accent fill so it reads as a deliberate
                commit, not a faded hint.
              */}
              <div style={{ display: 'flex', gap: 6 }}>
                {(['portrait', 'landscape'] as const).map((opt) => {
                  const active = orientation === opt
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPhotoOrientation(slot, opt)}
                      disabled={!dataUrl}
                      style={{
                        flex: 1,
                        padding: '6px 4px',
                        fontSize: 10,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        background: active ? tokens.accent : tokens.surface,
                        color: active ? tokens.accentText : tokens.textPrimary,
                        border: `0.5px solid ${active ? tokens.accent : tokens.border}`,
                        borderRadius: tokens.radius.button,
                        fontFamily: 'inherit',
                        cursor: dataUrl ? 'pointer' : 'not-allowed',
                        opacity: dataUrl ? 1 : 0.35,
                      }}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/*
        Brand color — the primary accent the cloner honors in CTAs, headings,
        hover states, and decorative elements. Two paths: extract dominant
        non-white from the uploaded logo, or pick any hex via the native
        color input. Active-state styling mirrors the orientation toggles
        above. Continue is gated on brandColor !== '' (see validation.ts).
      */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888', margin: '0 0 6px' }}>
          Brand color
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {([
            { id: 'logo' as const, label: 'From my logo', onClick: pickLogoColor, disabled: !logoDataUrl },
            { id: 'custom' as const, label: 'Pick custom', onClick: pickCustomColor, disabled: false },
          ]).map(({ id, label, onClick, disabled }) => {
            const active = brandColorMode === id
            return (
              <button
                key={id}
                type="button"
                onClick={onClick}
                disabled={disabled}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: active ? tokens.accent : tokens.surface,
                  color: active ? tokens.accentText : tokens.textPrimary,
                  border: `0.5px solid ${active ? tokens.accent : tokens.border}`,
                  borderRadius: tokens.radius.button,
                  fontFamily: 'inherit',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.35 : 1,
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: tokens.radius.button,
            border: `0.5px solid ${tokens.border}`,
            background: brandColor || 'transparent',
          }} />
          <div style={{ fontSize: 12, color: tokens.textPrimary, fontFamily: 'monospace', letterSpacing: '0.02em' }}>
            {brandColor || '\u2014'}
          </div>
        </div>
        <input
          ref={colorInput}
          type="color"
          value={brandColor || '#000000'}
          onChange={(e) => {
            setBrandColor(e.target.value)
            setBrandColorMode('custom')
          }}
          style={{ display: 'none' }}
        />
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
