import { View, Text, StyleSheet } from 'react-native';
import { SessionStatus } from '@/agent/types';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

const LABELS: Record<SessionStatus, string> = {
  idle:       'ready',
  connecting: 'connecting',
  joined:     'narrator joined',
  listening:  'listening',
  narrating:  'narrator speaking',
  error:      'error',
};

const DOT_COLORS: Record<SessionStatus, string> = {
  idle:       colors.textMuted,
  connecting: colors.accentAmber,
  joined:     colors.accentSlate,
  listening:  colors.accentSlate,
  narrating:  colors.accentAmber,
  error:      colors.danger,
};

export function StatusChip({ status }: { status: SessionStatus }) {
  return (
    <View style={styles.chip}>
      <View style={[styles.dot, { backgroundColor: DOT_COLORS[status] }]} />
      <Text style={styles.label}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
    fontSize: 11,
  },
});
