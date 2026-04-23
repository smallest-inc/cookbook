import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SessionError } from '@/agent/types';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

interface Props {
  error: SessionError;
  onRetry?: () => void;
  onDismiss: () => void;
}

const TITLE_BY_KIND: Record<SessionError['kind'], string> = {
  permission:     'Microphone blocked',
  'missing-config': 'Setup needed',
  network:        'Connection lost',
  auth:           'Authentication failed',
  server:         'Agent reported an error',
  unknown:        'Something went wrong',
};

const HINT_BY_KIND: Record<SessionError['kind'], string> = {
  permission:     'Grant microphone access in Settings and try again.',
  'missing-config': 'Fill SMALLEST_API_KEY and AGENT_ID in the .env file at the project root.',
  network:        'Check your connection and retry.',
  auth:           'Check your API key and agent ID in .env.',
  server:         'The agent returned an error. Check the message below.',
  unknown:        'Check the log and retry.',
};

export function ErrorBanner({ error, onRetry, onDismiss }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{TITLE_BY_KIND[error.kind]}</Text>
      <Text style={styles.hint}>{HINT_BY_KIND[error.kind]}</Text>
      <Text style={styles.detail} numberOfLines={3}>{error.message}</Text>
      <View style={styles.actions}>
        <Pressable onPress={onDismiss} style={styles.ghost}>
          <Text style={styles.ghostLabel}>Dismiss</Text>
        </Pressable>
        {error.retryable && onRetry ? (
          <Pressable onPress={onRetry} style={styles.retry}>
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  title: {
    ...typography.label,
    color: colors.danger,
  },
  hint: {
    ...typography.body,
    color: colors.textPrimary,
  },
  detail: {
    ...typography.body,
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'Courier',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  ghost: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ghostLabel: {
    ...typography.button,
    color: colors.textMuted,
  },
  retry: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: colors.accentAmber,
  },
  retryLabel: {
    ...typography.button,
    color: colors.bg,
  },
});
