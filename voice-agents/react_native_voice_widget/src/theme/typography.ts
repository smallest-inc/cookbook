import { Platform, TextStyle } from 'react-native';

const sans = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

export const typography = {
  heading: {
    fontFamily: sans,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.1,
  } satisfies TextStyle,
  body: {
    fontFamily: sans,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
  } satisfies TextStyle,
  bodyStrong: {
    fontFamily: sans,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  } satisfies TextStyle,
  caption: {
    fontFamily: sans,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  } satisfies TextStyle,
  label: {
    fontFamily: sans,
    fontSize: 13,
    fontWeight: '600',
  } satisfies TextStyle,
  meta: {
    fontFamily: sans,
    fontSize: 12,
    fontWeight: '500',
  } satisfies TextStyle,
} as const;
