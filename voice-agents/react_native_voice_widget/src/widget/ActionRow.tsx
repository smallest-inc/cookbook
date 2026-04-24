import { Pressable, StyleSheet, View } from 'react-native';
import { MicButton } from './MicButton';
import { colors } from '@/theme/colors';

interface Props {
  active: boolean;
  muted: boolean;
  onMicPress: () => void;
  onKeyboardPress?: () => void;
  onClosePress: () => void;
}

export function ActionRow({ active, muted, onMicPress, onKeyboardPress, onClosePress }: Props) {
  return (
    <View style={styles.row}>
      <IconButton glyph="keyboard" onPress={onKeyboardPress} disabled={!onKeyboardPress} />
      <MicButton active={active} muted={muted} onPress={onMicPress} />
      <IconButton glyph="close" onPress={onClosePress} />
    </View>
  );
}

function IconButton({
  glyph, onPress, disabled,
}: { glyph: 'keyboard' | 'close'; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      style={({ pressed }) => [
        styles.iconBtn,
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
      ]}
    >
      {glyph === 'keyboard' ? <KeyboardGlyph /> : <CloseGlyph />}
    </Pressable>
  );
}

function KeyboardGlyph() {
  return (
    <View style={keyStyles.wrap}>
      <View style={keyStyles.outer} />
      <View style={keyStyles.rowWrap}>
        {Array.from({ length: 3 }).map((_, i) => <View key={i} style={keyStyles.key} />)}
      </View>
      <View style={keyStyles.spacer} />
    </View>
  );
}

function CloseGlyph() {
  return (
    <View style={closeStyles.wrap}>
      <View style={[closeStyles.bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[closeStyles.bar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
});

const keyStyles = StyleSheet.create({
  wrap: { width: 18, height: 12, alignItems: 'center', justifyContent: 'center' },
  outer: {
    position: 'absolute',
    width: 18, height: 12,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
  },
  rowWrap: {
    flexDirection: 'row', gap: 1.5,
    marginTop: -2,
  },
  key: { width: 2, height: 1.5, backgroundColor: colors.textSecondary, borderRadius: 1 },
  spacer: { width: 8, height: 1.5, backgroundColor: colors.textSecondary, borderRadius: 1, marginTop: 1.5 },
});

const closeStyles = StyleSheet.create({
  wrap: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  bar: {
    position: 'absolute',
    width: 16, height: 1.5,
    borderRadius: 1,
    backgroundColor: colors.textSecondary,
  },
});
