import { Platform, TextStyle } from 'react-native';

// System fonts only. Loading a webfont is optional and orthogonal; the
// experience degrades gracefully on systems without Lora.
const serifFamily = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
const sansFamily  = Platform.select({ ios: 'System',  android: 'sans-serif', default: 'System' });

export const typography = {
  title: {
    fontFamily: serifFamily,
    fontSize: 40,
    fontWeight: '400',
    letterSpacing: 0.5,
  } satisfies TextStyle,
  subtitle: {
    fontFamily: serifFamily,
    fontSize: 16,
    fontStyle: 'italic',
    fontWeight: '400',
  } satisfies TextStyle,
  body: {
    fontFamily: sansFamily,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  } satisfies TextStyle,
  label: {
    fontFamily: sansFamily,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  } satisfies TextStyle,
  button: {
    fontFamily: sansFamily,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.4,
  } satisfies TextStyle,
} as const;
