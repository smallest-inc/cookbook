import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '@/theme/colors';

interface Props {
  level: number;   // 0..1, current audio RMS
  active: boolean;
}

const BARS = 9;
const MIN = 4;
const MAX = 26;

// Compact animated waveform — 9 vertical bars, center-weighted envelope so
// the outer bars never spike alone and the whole thing reads as one pulse.
export function Waveform({ level, active }: Props) {
  const anims = useRef<Animated.Value[]>(
    Array.from({ length: BARS }, () => new Animated.Value(MIN)),
  );

  useEffect(() => {
    const normalized = Math.max(0, Math.min(1, level * 3.0));
    anims.current.forEach((anim, i) => {
      // Triangular envelope so the centre bar is loudest for a given RMS.
      const weight = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2);
      const target = active
        ? MIN + (MIN + weight * (MAX - MIN)) * normalized + weight * 3
        : MIN;
      Animated.timing(anim, {
        toValue: Math.max(MIN, Math.min(MAX, target)),
        duration: 110,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    });
  }, [level, active]);

  return (
    <View style={styles.row}>
      {anims.current.map((anim, i) => (
        <Animated.View
          key={i}
          style={[styles.bar, { height: anim, backgroundColor: active ? colors.teal : colors.divider }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: MAX + 4,
    gap: 4,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
});
