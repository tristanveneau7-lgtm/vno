import { create } from 'zustand'

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

export type Vibe = 'editorial' | 'modern' | 'heritage'

export interface Assets {
  logoDataUrl: string | null
  photo1DataUrl: string | null
  photo2DataUrl: string | null
}

export interface QuizState {
  vertical: Vertical | null
  business: BusinessInfo
  sections: Sections
  vibe: Vibe | null
  assets: Assets
  anythingSpecial: string

  setVertical: (v: Vertical) => void
  setBusiness: (b: Partial<BusinessInfo>) => void
  toggleSection: (key: keyof Omit<Sections, 'landing'>) => void
  setVibe: (v: Vibe) => void
  setLogo: (dataUrl: string | null) => void
  setPhoto: (slot: 1 | 2, dataUrl: string | null) => void
  setAnythingSpecial: (text: string) => void
  reset: () => void
}

const initialState = {
  vertical: null,
  business: { name: '', address: '', phone: '', hours: '', slogan: '' },
  sections: { landing: true as const, gallery: true, phoneCta: true, booking: true, pricing: false, about: false },
  vibe: null,
  assets: { logoDataUrl: null, photo1DataUrl: null, photo2DataUrl: null },
  anythingSpecial: '',
}

export const useQuiz = create<QuizState>((set) => ({
  ...initialState,
  setVertical: (v) => set({ vertical: v }),
  setBusiness: (b) => set((s) => ({ business: { ...s.business, ...b } })),
  toggleSection: (key) => set((s) => ({ sections: { ...s.sections, [key]: !s.sections[key] } })),
  setVibe: (v) => set({ vibe: v }),
  setLogo: (dataUrl) => set((s) => ({ assets: { ...s.assets, logoDataUrl: dataUrl } })),
  setPhoto: (slot, dataUrl) => set((s) => ({ assets: { ...s.assets, [`photo${slot}DataUrl`]: dataUrl } })),
  setAnythingSpecial: (text) => set({ anythingSpecial: text }),
  reset: () => set(initialState),
}))
