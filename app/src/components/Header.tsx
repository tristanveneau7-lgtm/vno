import { tokens } from '../lib/tokens'

type Props = {
  step?: string
  marginBottom?: number | string
  rightColor?: string
}

export function Header({ step, marginBottom = tokens.spacing.headerMarginBottom, rightColor }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom,
      }}
    >
      <span
        style={{
          fontSize: tokens.font.wordmark.size,
          letterSpacing: tokens.font.wordmark.letterSpacing,
          fontWeight: tokens.font.wordmark.weight,
        }}
      >
        VNO
      </span>
      {step && (
        <span
          style={{
            fontSize: tokens.font.step.size,
            color: rightColor ?? tokens.font.step.color,
          }}
        >
          {step}
        </span>
      )}
    </div>
  )
}
