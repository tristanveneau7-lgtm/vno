import type { CSSProperties, ReactNode } from 'react'
import { tokens } from '../lib/tokens'

type Props = {
  children?: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
  padding?: string
  fontSize?: string | number
  radius?: string
  style?: CSSProperties
}

export function ContinueButton({
  children = 'Continue',
  onClick,
  disabled = false,
  variant = 'primary',
  padding = '13px',
  fontSize = '13px',
  radius = tokens.radius.button,
  style,
}: Props) {
  const primary = variant === 'primary'
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding,
        background: primary ? tokens.accent : tokens.surface,
        color: primary ? tokens.accentText : tokens.textPrimary,
        border: primary ? 'none' : `0.5px solid ${tokens.border}`,
        textAlign: 'center',
        fontSize,
        fontWeight: 500,
        borderRadius: radius,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'opacity 120ms ease-out',
        fontFamily: 'inherit',
        ...style,
      }}
    >
      {children}
    </button>
  )
}
