import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { colors } from '@/theme/colors';

interface Props {
  active: boolean;      // true while recording / listening
  muted: boolean;
  onPress: () => void;
}

// Large circular mic button with a soft pulse halo when active. Primary CTA
// of the widget — positioned center of the action row.
export function MicButton({ active, muted, onPress }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active || muted) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, muted, pulse]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  const buttonColor = muted ? colors.coral : colors.teal;

  return (
    <Pressable onPress={onPress} style={styles.wrap} hitSlop={12}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          { backgroundColor: buttonColor, opacity: haloOpacity, transform: [{ scale: haloScale }] },
        ]}
      />
      <View style={[styles.button, { backgroundColor: buttonColor }]}>
        <MicIcon muted={muted} />
      </View>
    </Pressable>
  );
}

// Inline SVG-style mic icon using Views — avoids adding an icon-font dep.
function MicIcon({ muted }: { muted: boolean }) {
  return (
    <View style={micStyles.wrap}>
      <View style={micStyles.body} />
      <View style={micStyles.stand} />
      <View style={micStyles.base} />
      {muted ? <View style={micStyles.slash} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 72, height: 72,
    alignItems: 'center', justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 64, height: 64, borderRadius: 32,
  },
  button: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
});

const micStyles = StyleSheet.create({
  wrap: { width: 20, height: 28, alignItems: 'center' },
  body: {
    width: 12, height: 16, borderRadius: 6,
    backgroundColor: colors.surface,
  },
  stand: {
    width: 2, height: 4,
    backgroundColor: colors.surface,
    marginTop: 2,
  },
  base: {
    width: 12, height: 2, borderRadius: 1,
    backgroundColor: colors.surface,
  },
  slash: {
    position: 'absolute',
    width: 28, height: 2,
    backgroundColor: colors.surface,
    top: 13, left: -4,
    transform: [{ rotate: '45deg' }],
  },
});
