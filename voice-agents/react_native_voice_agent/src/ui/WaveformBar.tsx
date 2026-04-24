import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { colors } from '@/theme/colors';

const BARS = 28;
const BASE_HEIGHT = 2;
const MAX_HEIGHT  = 48;

// Renders a row of vertical bars whose heights track a rolling window of
// the incoming level signal. Pushes a new sample whenever `level` updates
// and shifts the window leftward so the rightmost bar is always the
// freshest reading.
interface Props {
  level: number;       // 0..1
  color: string;
  active: boolean;     // true when this side owns the mic/speaker
}

export function WaveformBar({ level, color, active }: Props) {
  const historyRef = useRef<number[]>(new Array(BARS).fill(0));
  const animatedRef = useRef<Animated.Value[]>(
    Array.from({ length: BARS }, () => new Animated.Value(BASE_HEIGHT)),
  );

  useEffect(() => {
    const history = historyRef.current;
    history.push(active ? level : 0);
    history.shift();
    animatedRef.current.forEach((anim, i) => {
      const v = history[i];
      const target = BASE_HEIGHT + Math.min(1, v * 3.2) * (MAX_HEIGHT - BASE_HEIGHT);
      Animated.timing(anim, {
        toValue: target,
        duration: 80,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    });
  }, [level, active]);

  return (
    <View style={styles.row}>
      {animatedRef.current.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              height: anim,
              backgroundColor: active ? color : colors.divider,
              opacity: active ? 0.92 : 0.45,
            },
          ]}
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
    height: MAX_HEIGHT,
    gap: 3,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
  },
});
