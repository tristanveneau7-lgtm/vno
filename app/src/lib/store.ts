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
 * Asset data URLs keyed to match the engine's /build payload shape exactly
 * — the engine validates req.body.assets.logo / photo1 / photo2 and renaming
 * these on the wire would mean editing two codebases every time. Values are
 * `data:image/...;base64,...` strings produced by Screen5Assets' FileReader.
 *
 * photo1Orientation / photo2Orientation are human-tagged (the user taps
 * Portrait or Landscape below each preview). We rely on human tagging rather
 * than EXIF detection because phone transfers (AirDrop / iCloud) routinely
 * strip the Orientation tag, so metadata isn't reliable. The engine forwards
 * these tags to the cloner so it places portraits in split layouts instead
 * of stretching them into wide heroes.
 */
export interface Assets {
  logo: string | null
  photo1: string | null
  photo2: string | null
  photo1Orientation: PhotoOrientation
  photo2Orientation: PhotoOrientation
}

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
  setLogo: (dataUrl: string | null) => void
  setPhoto: (slot: 1 | 2, dataUrl: string | null) => void
  setPhotoOrientation: (slot: 1 | 2, orientation: Exclude<PhotoOrientation, null>) => void
  setAnythingSpecial: (text: string) => void
  reset: () => void
}

const initialState = {
  vertical: null,
  business: { name: '', address: '', phone: '', hours: '', slogan: '' },
  sections: { landing: true as const, gallery: true, phoneCta: true, booking: true, pricing: false, about: false },
  reference: null,
  assets: { logo: null, photo1: null, photo2: null, photo1Orientation: null, photo2Orientation: null } as Assets,
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
      setLogo: (dataUrl) => set((s) => ({ assets: { ...s.assets, logo: dataUrl } })),
      // Re-uploading a photo clears its orientation tag — the new photo may be a
      // different orientation from the previous one, and silently carrying over
      // the old tag would ship a mislabelled asset to the engine.
      setPhoto: (slot, dataUrl) => set((s) => ({
        assets: {
          ...s.assets,
          [`photo${slot}`]: dataUrl,
          [`photo${slot}Orientation`]: null,
        },
      })),
      setPhotoOrientation: (slot, orientation) => set((s) => ({
        assets: { ...s.assets, [`photo${slot}Orientation`]: orientation },
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
      // v5 (Phase 6.2): Vertical union gained 'business' and 'golf'. Old
      // persisted states with only the original 10 verticals remain decode-
      // compatible (no shrinkage), but bumping defensively so any stale
      // shape we haven't anticipated gets discarded and rehydrated from the
      // initial state rather than surfacing as a runtime type mismatch.
      version: 5,
    }
  )
)
