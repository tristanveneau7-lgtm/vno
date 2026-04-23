import { useQuiz } from './store'

export function useCanContinue(step: number): boolean {
  const state = useQuiz()
  switch (step) {
    case 1: return state.vertical !== null
    case 2: return state.business.name.trim() !== ''
             && state.business.address.trim() !== ''
             && state.business.phone.trim() !== ''
             && state.business.hours.trim() !== ''
    case 3: return true
    case 4: return state.reference !== null
    case 5: {
      // Phase Tampa Item 0 shape. Rules:
      //   - Logo is required. It's the first-class anchor for palette
      //     extraction and downstream engine validation; nothing else
      //     substitutes.
      //   - At least 2 of { outside, inside, hero } must be populated.
      //     Two is enough context for the cloner + the Art Director; the
      //     fourth slot is optional (Hero / Feature).
      //   - Every populated non-logo slot must have its orientation tagged.
      //     Forcing the tap here is what keeps the engine from guessing and
      //     mis-placing a portrait into a wide hero layout — same rule as
      //     pre-Tampa, re-expressed against the keyed-object shape. Logo
      //     never carries orientation, so it's not part of this check.
      //   - Palette: all three slots populated, as before. An empty slot
      //     means untouched, and the engine would 400 on submit anyway.
      const { photos, palette } = state.assets
      const nonLogo = [photos.outside, photos.inside, photos.hero]
      const present = nonLogo.filter((p): p is NonNullable<typeof p> => p !== null)
      return (
        photos.logo !== null &&
        present.length >= 2 &&
        present.every((p) => p.orientation !== null) &&
        palette.primary !== '' &&
        palette.secondary !== '' &&
        palette.accent !== ''
      )
    }
    case 6: return true
    case 7: return true
    default: return false
  }
}
