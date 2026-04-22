import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Vertical = 'tattoo' | 'groomer' | 'barber' | 'salon' | 'trades' | 'restaurant' | 'gym' | 'health' | 'auto' | 'daycare'

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

/**
 * Asset data URLs keyed to match the engine's /build payload shape exactly
 * — the engine validates req.body.assets.logo / photo1 / photo2 and renaming
 * these on the wire would mean editing two codebases every time. Values are
 * `data:image/...;base64,...` strings produced by Screen5Assets' FileReader.
 */
export interface Assets {
  logo: string | null
  photo1: string | null
  photo2: string | null
}

export interface ReferenceChoice {
  url: string
  label: string
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
  setAnythingSpecial: (text: string) => void
  reset: () => void
}

const initialState = {
  vertical: null,
  business: { name: '', address: '', phone: '', hours: '', slogan: '' },
  sections: { landing: true as const, gallery: true, phoneCta: true, booking: true, pricing: false, about: false },
  reference: null,
  assets: { logo: null, photo1: null, photo2: null },
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
      setPhoto: (slot, dataUrl) => set((s) => ({ assets: { ...s.assets, [`photo${slot}`]: dataUrl } })),
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
      version: 3,
    }
  )
)
