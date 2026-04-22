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
    case 5:
      return (
        state.assets.logo !== null &&
        state.assets.photo1 !== null &&
        state.assets.photo2 !== null
      )
    case 6: return true
    case 7: return true
    default: return false
  }
}
