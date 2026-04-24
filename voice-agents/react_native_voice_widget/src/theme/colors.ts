// Smallest AI brand palette. Do not invent colors; pick from this file.
export const colors = {
  // Dark foundation
  ink:       '#092023',   // near-black teal; primary text on light surfaces
  inkSoft:   '#1D4E52',   // secondary dark text / dark surfaces

  // Primary accent (the ONE brand teal)
  teal:      '#43B6B6',
  tealSoft:  '#43B6B622',  // 13% teal overlay for halos / subtle fills

  // Light surfaces (warm creams, not pure white)
  surface:       '#FBFAF5',  // default light surface
  surfaceAlt:    '#F8F7F2',  // elevated / card
  surfaceHighlight: '#FCFBFA', // subtle highlight
  divider:       '#EFEDE9',  // warm light gray borders

  // Secondary accents
  gold:      '#FFCF72',
  coral:     '#FF5E5E',   // danger / destructive
  blue:      '#3E91D5',   // informational

  // Text scale on light surfaces
  textPrimary:    '#092023',
  textSecondary:  '#1D4E52',
  textMuted:      '#092023AA',
  textOnDark:     '#FCFBFA',
} as const;
