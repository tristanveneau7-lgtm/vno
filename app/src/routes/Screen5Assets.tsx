import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'
import { useQuiz, type PaletteSlot, type Photo, type PhotoOrientation, type PhotoRole } from '../lib/store'
import { useCanContinue } from '../lib/validation'
import { extractLogoPalette } from '../lib/extractLogoColor'

type PaletteSource = 'extracted' | 'manual' | null

/**
 * Per-slot metadata that drives the four labeled uploaders. Ordered
 * top-to-bottom by upload order we expect the user to follow: logo first
 * (anchors palette extraction), then the two recommended context shots,
 * then the optional feature shot. The engine doesn't care about order —
 * this is purely a UX sequencing choice.
 */
const SLOT_CONFIG: Array<{
  role: PhotoRole
  label: string
  requirement: 'required' | 'recommended' | 'optional'
  hint: string
  showOrientation: boolean
}> = [
  {
    role: 'logo',
    label: 'Logo',
    requirement: 'required',
    hint: "Paste or upload the business's logo. Usually grabbed from Google manually.",
    showOrientation: false,
  },
  {
    role: 'outside',
    label: 'Outside',
    requirement: 'recommended',
    hint: 'Exterior shot of the shop, building, or signage.',
    showOrientation: true,
  },
  {
    role: 'inside',
    label: 'Inside',
    requirement: 'recommended',
    hint: 'Interior shot — where customers spend time.',
    showOrientation: true,
  },
  {
    role: 'hero',
    label: 'Hero / Feature',
    requirement: 'optional',
    hint: 'Owner, signature service, or the thing that best represents this business.',
    showOrientation: true,
  },
]

const REQUIREMENT_LABEL: Record<'required' | 'recommended' | 'optional', string> = {
  required: 'REQUIRED',
  recommended: 'RECOMMENDED',
  optional: 'OPTIONAL',
}

export function Screen5Assets() {
  const navigate = useNavigate()
  const photos = useQuiz((s) => s.assets.photos)
  const palette = useQuiz((s) => s.assets.palette)
  const setPhoto = useQuiz((s) => s.setPhoto)
  const setPhotoOrientation = useQuiz((s) => s.setPhotoOrientation)
  const setPaletteColor = useQuiz((s) => s.setPaletteColor)
  const canContinue = useCanContinue(5)

  const fileInput = useRef<HTMLInputElement>(null)
  // Which slot the pending file-picker click is targeting. A ref (not state)
  // because tapping "upload" on a slot opens the native picker synchronously
  // and we just need to remember the target until the change event fires.
  const target = useRef<PhotoRole>('logo')

  // How the current palette was produced. 'extracted' = populated by the
  // "From my logo" tap; 'manual' = any per-swatch override via the native
  // color picker. Tracked in a ref (not state) because no render depends on
  // it — only this component's pick handlers and the effect below read it.
  const paletteSourceRef = useRef<PaletteSource>(null)
  const logoDataUrl = photos.logo?.dataUrl ?? null
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

  const pick = (role: PhotoRole) => {
    target.current = role
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
      setPhoto(target.current, dataUrl)
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
        Logo required. At least two of outside / inside / hero. Tap each photo's orientation so the layout places it right.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 22 }}>
        {SLOT_CONFIG.map((config) => (
          <PhotoSlotCard
            key={config.role}
            config={config}
            photo={photos[config.role]}
            onUpload={() => pick(config.role)}
            onRemove={() => setPhoto(config.role, null)}
            onOrientation={
              config.showOrientation
                ? (orientation) =>
                    setPhotoOrientation(
                      // Narrowed by the SLOT_CONFIG.showOrientation=false
                      // branch above; the non-logo roles are the only ones
                      // that ever call onOrientation.
                      config.role as Exclude<PhotoRole, 'logo'>,
                      orientation
                    )
                : undefined
            }
          />
        ))}
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

/**
 * One of the four labeled upload slots on Screen 5. Renders as a stacked
 * card: label + requirement badge, hint copy, upload/preview area,
 * remove button when populated, and — for non-logo slots only — an
 * orientation toggle underneath.
 *
 * Kept in this file (not extracted) because this is the only place the
 * component is used and its prop shape is tightly coupled to Screen 5's
 * state model.
 */
function PhotoSlotCard({
  config,
  photo,
  onUpload,
  onRemove,
  onOrientation,
}: {
  config: (typeof SLOT_CONFIG)[number]
  photo: Photo | null
  onUpload: () => void
  onRemove: () => void
  onOrientation: ((orientation: Exclude<PhotoOrientation, null>) => void) | undefined
}) {
  const populated = photo !== null
  const isLogo = config.role === 'logo'
  const requirementColor =
    config.requirement === 'required'
      ? tokens.textPrimary
      : config.requirement === 'recommended'
        ? '#888'
        : '#666'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 0 4px' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: tokens.textPrimary, letterSpacing: '0.01em' }}>
          {config.label}
        </div>
        <div style={{ fontSize: 9, letterSpacing: '0.1em', color: requirementColor }}>
          {REQUIREMENT_LABEL[config.requirement]}
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#888', margin: '0 0 8px', lineHeight: 1.35 }}>
        {config.hint}
      </div>

      <button
        type="button"
        onClick={onUpload}
        style={{
          background: tokens.surface,
          border: '0.5px dashed #333',
          borderRadius: tokens.radius.card,
          padding: populated ? 0 : isLogo ? 24 : 22,
          width: '100%',
          minHeight: isLogo ? 110 : 120,
          fontFamily: 'inherit',
          color: tokens.textPrimary,
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {populated ? (
          isLogo ? (
            <div style={{
              width: '100%',
              height: 110,
              background: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: tokens.radius.card,
              overflow: 'hidden',
            }}>
              <img
                src={photo.dataUrl}
                alt="Logo"
                style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }}
              />
            </div>
          ) : (
            <img
              src={photo.dataUrl}
              alt={config.label}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: tokens.radius.card,
              }}
            />
          )
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, lineHeight: 1, color: '#555' }}>+</div>
            <div style={{ fontSize: 10, marginTop: 6, letterSpacing: '0.08em', color: '#555' }}>
              TAP TO UPLOAD
            </div>
          </div>
        )}

        {/*
          Remove affordance. Absolute-positioned top-right of the preview so
          the whole-card tap still means "replace" — the × is a deliberate
          out-of-band target. stopPropagation prevents the parent upload
          button from also firing when the user hits remove.
        */}
        {populated && (
          <div
            role="button"
            aria-label={`Remove ${config.label}`}
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 24,
              height: 24,
              borderRadius: 12,
              background: 'rgba(10,10,10,0.75)',
              border: '0.5px solid rgba(255,255,255,0.25)',
              color: tokens.textPrimary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ×
          </div>
        )}
      </button>

      {onOrientation && (
        // Orientation toggle — rendered for non-logo slots only. Disabled
        // until a photo is uploaded because tagging orientation without a
        // photo has no meaning. Selected state flips to the accent fill so
        // it reads as a deliberate commit, not a faded hint.
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {(['portrait', 'landscape'] as const).map((opt) => {
            const active = photo?.orientation === opt
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onOrientation(opt)}
                disabled={!populated}
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
                  cursor: populated ? 'pointer' : 'not-allowed',
                  opacity: populated ? 1 : 0.35,
                }}
              >
                {opt}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
