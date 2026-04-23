import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Vertical = 'tattoo' | 'groomer' | 'barber' | 'salon' | 'trades' | 'restaurant' | 'gym' | 'golf' | 'health' | 'auto' | 'daycare' | 'business'

export interface BusinessInfo {
  name: string
  address: string
  phone: string
  hours: string
  slogan: string
}

export interface Sections {
  landing: true
  gallery: boolean
  phoneCta: boolean
  booking: boolean
  pricing: boolean
  about: boolean
}

export type PhotoOrientation = 'portrait' | 'landscape' | null

/**
 * Semantic role of an uploaded asset. Captured deliberately on Screen 5
 * instead of inferred positionally so that out-of-order captures don't
 * silently mis-label (positional conventions were considered and rejected —
 * real-world-messy input is the product's whole pitch). Downstream the engine
 * validates each photo carries a valid role; the Art Director agent (Phase
 * Tampa Item 3) uses the role to reason about layout and treatment instead
 * of guessing from pixel content.
 *
 * Logos are treated as a first-class role here rather than a separate
 * `logo` field so the four slots share one uniform shape and one setter API.
 * The logo slot just ignores orientation at the API boundary (logos don't
 * need a portrait/landscape tag — they're placed by the cloner regardless).
 */
export type PhotoRole = 'logo' | 'outside' | 'inside' | 'hero'

export const PHOTO_ROLES: readonly PhotoRole[] = ['logo', 'outside', 'inside', 'hero'] as const

/**
 * A single uploaded asset. `dataUrl` is a `data:image/...;base64,...` string
 * produced by Screen5Assets' FileReader. `orientation` is human-tagged by the
 * user tapping Portrait or Landscape beneath the preview — EXIF is
 * unreliable because phone transfers (AirDrop / iCloud) routinely strip the
 * Orientation tag. For the logo slot `orientation` is always null (logos
 * don't carry the tag); it's kept on the shared type so the four slots can
 * share one setter API.
 */
export interface Photo {
  dataUrl: string
  orientation: PhotoOrientation
}

/**
 * The four labeled upload slots. Each is either a populated `Photo` or
 * `null`. Continue-gating rules live in validation.ts and expect:
 *   - `logo` populated (required)
 *   - at least 2 of { outside, inside, hero } populated
 *   - every non-logo populated slot must have its orientation tagged
 * Flattened to an array `{ role, dataUrl, orientation }` at the API
 * boundary (see lib/api.ts) so the engine doesn't need to know about the
 * app's keyed-object shape.
 */
export interface Photos {
  logo: Photo | null
  outside: Photo | null
  inside: Photo | null
  hero: Photo | null
}

export interface Assets {
  photos: Photos
  /**
   * Three hex colors with semantic roles that the cloner honors across the
   * generated site: primary (dominant CTAs, hero accents, brand-bar), secondary
   * (supporting CTAs, alternating section accents), accent (hover states,
   * badges, micro-decorations). Each slot is either extracted from the logo
   * via {@link extractLogoPalette} or overridden individually via the native
   * color picker on Screen 5. Empty string on any slot means "not yet set";
   * Screen 5 gates continue on all three being non-empty, and the engine
   * validates each slot's hex shape on the /build request.
   */
  palette: {
    primary: string
    secondary: string
    accent: string
  }
}

export type PaletteSlot = 'primary' | 'secondary' | 'accent'

export interface ReferenceChoice {
  url: string
  label: string
  /**
   * Optional direct image/video URL — mirrored from the picked Reference in
   * references.ts. When present, the engine fetches it directly (mp4 → ffmpeg
   * first frame; else image buffer) instead of running Puppeteer against `url`.
   * Absent for legacy refs that only have a live page to screenshot.
   */
  imageUrl?: string
}

export interface QuizState {
  vertical: Vertical | null
  business: BusinessInfo
  sections: Sections
  reference: ReferenceChoice | null
  assets: Assets
  anythingSpecial: string

  setVertical: (v: Vertical) => void
  setBusiness: (b: Partial<BusinessInfo>) => void
  toggleSection: (key: keyof Omit<Sections, 'landing'>) => void
  setReference: (r: ReferenceChoice | null) => void
  /**
   * Populate or clear a slot. Passing `null` clears; passing a string replaces
   * the dataUrl and resets orientation to null (the new photo may be a
   * different orientation from the previous one, and carrying over the old
   * tag would ship a mislabelled asset).
   */
  setPhoto: (role: PhotoRole, dataUrl: string | null) => void
  /**
   * Tag orientation for a non-logo photo slot. Logo never carries orientation.
   */
  setPhotoOrientation: (role: Exclude<PhotoRole, 'logo'>, orientation: Exclude<PhotoOrientation, null>) => void
  setPaletteColor: (slot: PaletteSlot, hex: string) => void
  setAnythingSpecial: (text: string) => void
  reset: () => void
}

const initialState = {
  vertical: null,
  business: { name: '', address: '', phone: '', hours: '', slogan: '' },
  sections: { landing: true as const, gallery: true, phoneCta: true, booking: true, pricing: false, about: false },
  reference: null,
  assets: {
    photos: {
      logo: null,
      outside: null,
      inside: null,
      hero: null,
    },
    palette: { primary: '', secondary: '', accent: '' },
  } as Assets,
  anythingSpecial: '',
}

export const useQuiz = create<QuizState>()(
  persist(
    (set) => ({
      ...initialState,
      setVertical: (v) => set({ vertical: v }),
      setBusiness: (b) => set((s) => ({ business: { ...s.business, ...b } })),
      toggleSection: (key) => set((s) => ({ sections: { ...s.sections, [key]: !s.sections[key] } })),
      setReference: (r) => set({ reference: r }),
      setPhoto: (role, dataUrl) => set((s) => ({
        assets: {
          ...s.assets,
          photos: {
            ...s.assets.photos,
            [role]: dataUrl === null
              ? null
              // Re-uploading clears orientation — see QuizState.setPhoto docstring.
              : { dataUrl, orientation: null },
          },
        },
      })),
      setPhotoOrientation: (role, orientation) => set((s) => {
        const existing = s.assets.photos[role]
        if (!existing) return {}
        return {
          assets: {
            ...s.assets,
            photos: {
              ...s.assets.photos,
              [role]: { ...existing, orientation },
            },
          },
        }
      }),
      setPaletteColor: (slot, hex) => set((s) => ({
        assets: { ...s.assets, palette: { ...s.assets.palette, [slot]: hex } },
      })),
      setAnythingSpecial: (text) => set({ anythingSpecial: text }),
      reset: () => set(initialState),
    }),
    {
      name: 'vno-quiz',
      // Partialize: persist text fields only. Base64 image data URLs can easily blow past
      // localStorage's ~5–10MB quota, and re-picking an image on refresh is acceptable UX.
      partialize: (state) => ({
        vertical: state.vertical,
        business: state.business,
        sections: state.sections,
        reference: state.reference,
        anythingSpecial: state.anythingSpecial,
      }),
      // v6 (Phase Tampa Item 0): Assets shape restructured — flat
      // logo/photo1/photo2/*Orientation fields collapse into a single
      // assets.photos: { logo, outside, inside, hero } keyed object carrying
      // Photo { dataUrl, orientation } per slot. Any old persisted state is
      // dropped (we're pre-prod; no user data loss concern) and rehydrated
      // from the initial state.
      version: 6,
    }
  )
)
