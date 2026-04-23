import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'
import { useQuiz, type PaletteSlot } from '../lib/store'
import { useCanContinue } from '../lib/validation'
import { extractLogoPalette } from '../lib/extractLogoColor'

type Target = 'logo' | 'photo1' | 'photo2'
type PaletteSource = 'extracted' | 'manual' | null

export function Screen5Assets() {
  const navigate = useNavigate()
  const {
    logo: logoDataUrl,
    photo1: photo1DataUrl,
    photo2: photo2DataUrl,
    photo1Orientation,
    photo2Orientation,
    palette,
  } = useQuiz((s) => s.assets)
  const setLogo = useQuiz((s) => s.setLogo)
  const setPhoto = useQuiz((s) => s.setPhoto)
  const setPhotoOrientation = useQuiz((s) => s.setPhotoOrientation)
  const setPaletteColor = useQuiz((s) => s.setPaletteColor)
  const canContinue = useCanContinue(5)

  const fileInput = useRef<HTMLInputElement>(null)
  const target = useRef<Target>('logo')

  // How the current palette was produced. 'extracted' = populated by the
  // "From my logo" tap; 'manual' = any per-swatch override via the native
  // color picker. Tracked in a ref (not state) because no render depends on
  // it — only this component's pick handlers and the effect below read it.
  const paletteSourceRef = useRef<PaletteSource>(null)
  // Previous logoDataUrl, held in a ref so the effect below only fires on
  // real logo changes, not on unrelated re-renders.
  const prevLogoRef = useRef<string | null>(logoDataUrl)

  // Swapping the logo invalidates an extracted palette (the colors no
  // longer reflect the current logo). Manual per-slot overrides survive the
  // change because they're explicit user choices, not logo-derived.
  useEffect(() => {
    if (prevLogoRef.current === logoDataUrl) return
    prevLogoRef.current = logoDataUrl
    if (paletteSourceRef.current === 'extracted') {
      setPaletteColor('primary', '')
      setPaletteColor('secondary', '')
      setPaletteColor('accent', '')
      paletteSourceRef.current = null
    }
  }, [logoDataUrl, setPaletteColor])

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

  // Re-runnable by design: every tap re-extracts from the current logo and
  // overwrites all three slots. Swapping the logo with an extracted palette
  // still in place clears it via the effect above, forcing a deliberate
  // re-tap. Errors are swallowed — we don't want a mid-demo dialog for a
  // color heuristic; the user can override any slot manually instead.
  const pickLogoPalette = async () => {
    if (!logoDataUrl) return
    try {
      const [primary, secondary, accent] = await extractLogoPalette(logoDataUrl)
      setPaletteColor('primary', primary)
      setPaletteColor('secondary', secondary)
      setPaletteColor('accent', accent)
      paletteSourceRef.current = 'extracted'
    } catch (err) {
      console.warn('logo palette extraction failed', err)
    }
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
        Brand palette — three hex colors with semantic roles (primary,
        secondary, accent) that the cloner honors across the generated site.
        "From my logo" extracts all three in one tap via the canvas-sampling
        heuristic; each swatch below is independently tappable to override
        the extraction or fill in a slot manually. Continue is gated on all
        three being non-empty (see validation.ts).

        iOS click pattern: each swatch is rendered as a <label> wrapping a
        visually-hidden <input type="color">. Tapping the label invokes the
        native picker on iOS Safari without needing a programmatic
        ref.click() — that approach is broken on iOS for hidden color
        inputs, which is what we're specifically routing around here.
      */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888', margin: '0 0 6px' }}>
          Brand palette
        </div>
        <button
          type="button"
          onClick={pickLogoPalette}
          disabled={!logoDataUrl}
          style={{
            width: '100%',
            padding: '6px 4px',
            fontSize: 10,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            background: tokens.surface,
            color: tokens.textPrimary,
            border: `0.5px solid ${tokens.border}`,
            borderRadius: tokens.radius.button,
            fontFamily: 'inherit',
            cursor: logoDataUrl ? 'pointer' : 'not-allowed',
            opacity: logoDataUrl ? 1 : 0.35,
            marginBottom: 10,
          }}
        >
          From my logo
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {(['primary', 'secondary', 'accent'] as const).map((slot: PaletteSlot) => {
            const hex = palette[slot]
            return (
              <label
                key={slot}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '0.08em', color: '#888', textTransform: 'uppercase' }}>
                  {slot}
                </div>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: tokens.radius.button,
                  border: `0.5px solid ${tokens.border}`,
                  background: hex || 'transparent',
                }} />
                <div style={{ fontSize: 11, color: tokens.textPrimary, fontFamily: 'monospace', letterSpacing: '0.02em' }}>
                  {hex || '\u2014'}
                </div>
                <input
                  type="color"
                  value={hex || '#000000'}
                  onChange={(e) => {
                    setPaletteColor(slot, e.target.value)
                    paletteSourceRef.current = 'manual'
                  }}
                  style={{
                    position: 'absolute',
                    width: 1,
                    height: 1,
                    opacity: 0,
                    pointerEvents: 'none',
                  }}
                />
              </label>
            )
          })}
        </div>
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
