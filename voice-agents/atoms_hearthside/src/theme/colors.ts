export const colors = {
  bg:           '#0E0B08',
  surface:      '#1A1411',
  surfaceHigh:  '#2A1F18',
  textPrimary:  '#F3EAD7',
  textMuted:    '#B49E83',
  accentAmber:  '#E5A86A',
  accentSlate:  '#5E7B8C',
  danger:       '#D97757',
  divider:      '#3A2E25',
} as const;

export type ColorKey = keyof typeof colors;
