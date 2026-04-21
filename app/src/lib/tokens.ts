export const tokens = {
  bg: '#0A0A0A',
  surface: '#161616',
  border: '#262626',
  textPrimary: '#F5F5F5',
  textSecondary: '#888888',
  textTertiary: '#666666',
  accent: '#FFFFFF',
  accentText: '#0A0A0A',

  radius: {
    button: '6px',
    card: '8px',
    container: '12px',
  },

  font: {
    wordmark: { size: '12px', weight: 500, letterSpacing: '0.18em' },
    step: { size: '11px', color: '#666666' },
    title: { size: '20px', weight: 500, letterSpacing: '-0.01em' },
    subtitle: { size: '12px', color: '#888888' },
    body: { size: '14px' },
    fieldLabel: { size: '11px', color: '#666666', letterSpacing: '0.05em', textTransform: 'uppercase' as const },
  },

  spacing: {
    screenPadding: '22px 18px',
    sectionGap: '14px',
    headerMarginBottom: '24px',
  },
} as const
