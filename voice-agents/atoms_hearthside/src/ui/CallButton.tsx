import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}

export function CallButton({ label, onPress, variant = 'primary', disabled, style }: Props) {
  const bg = variant === 'danger' ? colors.danger : colors.accentAmber;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.78 : 1 },
        style,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 200,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.button,
    color: colors.bg,
  },
});
