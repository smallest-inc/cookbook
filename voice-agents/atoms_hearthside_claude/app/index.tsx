import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAtomsSession } from '@/hooks/useAtomsSession';
import { StatusChip } from '@/ui/StatusChip';
import { CallButton } from '@/ui/CallButton';
import { TitleCard } from '@/ui/TitleCard';
import { WaveformBar } from '@/ui/WaveformBar';
import { ErrorBanner } from '@/ui/ErrorBanner';
import { colors } from '@/theme/colors';

// Credentials come from .env via Expo's public env var path (EXPO_PUBLIC_*
// is inlined at build time). The script at scripts/setup_agent.py writes
// AGENT_ID for you; SMALLEST_API_KEY is whatever the user sets.
const API_KEY = process.env.EXPO_PUBLIC_SMALLEST_API_KEY;
const AGENT_ID = process.env.EXPO_PUBLIC_AGENT_ID;

export default function Index() {
  const { status, error, micLevel, agentLevel, start, stop } = useAtomsSession({
    apiKey: API_KEY,
    agentId: AGENT_ID,
  });

  const inSession = status === 'connecting' || status === 'listening' || status === 'narrating';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topSlot}>
          {inSession ? <StatusChip status={status} /> : null}
        </View>

        <View style={styles.center}>
          {!inSession && status !== 'error' ? (
            <TitleCard title="Hearthside" subtitle="a voice-told story" />
          ) : null}

          {inSession ? (
            <View style={styles.waveStack}>
              <WaveformBar
                level={agentLevel}
                color={colors.accentAmber}
                active={status === 'narrating'}
              />
              <WaveformBar
                level={micLevel}
                color={colors.accentSlate}
                active={status === 'listening'}
              />
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorWrap}>
              <ErrorBanner
                error={error}
                onRetry={error.retryable ? start : undefined}
                onDismiss={stop}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.bottomSlot}>
          {inSession ? (
            <CallButton label="End story" onPress={stop} variant="danger" />
          ) : (
            <CallButton
              label={error ? 'Try again' : 'Begin story'}
              onPress={error && !error.retryable ? stop : start}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    justifyContent: 'space-between',
  },
  topSlot: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48,
  },
  waveStack: {
    gap: 16,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  errorWrap: {
    alignSelf: 'stretch',
  },
  bottomSlot: {
    alignItems: 'center',
  },
});
