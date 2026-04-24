import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { SessionStatus } from '@/agent/types';

interface Props { status: SessionStatus }

const LABEL: Record<SessionStatus, string> = {
  idle:       'Tap the mic to start',
  connecting: 'Connecting…',
  joined:     'Assistant joined',
  listening:  'Listening',
  narrating:  'Speaking',
  error:      'Something went wrong',
};

const DOT: Record<SessionStatus, string> = {
  idle:       colors.divider,
  connecting: colors.gold,
  joined:     colors.teal,
  listening:  colors.teal,
  narrating:  colors.teal,
  error:      colors.coral,
};

export function StatusLine({ status }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: DOT[status] }]} />
      <Text style={styles.label}>{LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: {
    ...typography.bodyStrong,
    color: colors.teal,
  },
});
