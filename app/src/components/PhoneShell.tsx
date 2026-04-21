import type { CSSProperties, ReactNode } from 'react'
import { tokens } from '../lib/tokens'

type Props = {
  children: ReactNode
  background?: string
  style?: CSSProperties
}

export function PhoneShell({ children, background, style }: Props) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: background ?? tokens.bg,
        color: tokens.textPrimary,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          padding: tokens.spacing.screenPadding,
          display: 'flex',
          flexDirection: 'column',
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  )
}
