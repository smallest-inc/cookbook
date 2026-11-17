import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAtomsSession } from '@/hooks/useAtomsSession';
import { StatusChip } from '@/ui/StatusChip';
import { CallButton } from '@/ui/CallButton';
import { TitleCard } from '@/ui/TitleCard';
import { WaveformBar } from '@/ui/WaveformBar';
import { ErrorBanner } from '@/ui/ErrorBanner';
import { SettingsSheet } from '@/ui/SettingsSheet';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

// EXPO_PUBLIC_* values are inlined into the JS bundle at build time, so only
// a non-secret URL goes here. The session server (../mobile_token_server)
// holds SMALLEST_API_KEY and AGENT_ID and mints short-lived tokens.
const TOKEN_SERVER_URL = process.env.EXPO_PUBLIC_TOKEN_SERVER_URL;

export default function Index() {
  const {
    status, error,
    micLevel, agentLevel, micChunksSent,
    muted, toggleMute,
    start, stop,
  } = useAtomsSession({ serverUrl: TOKEN_SERVER_URL });

  const [settingsOpen, setSettingsOpen] = useState(false);

  const inSession =
    status === 'connecting' ||
    status === 'joined' ||
    status === 'listening' ||
    status === 'narrating';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topSlot}>
          {inSession ? <StatusChip status={status} /> : null}
          {!inSession ? (
            <Pressable
              onPress={() => setSettingsOpen(true)}
              style={({ pressed }) => [
                styles.gearBtn,
                pressed && { opacity: 0.6 },
              ]}
              hitSlop={10}
            >
              <Text style={styles.gearText}>settings</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.center}>
          {!inSession && status !== 'error' ? (
            <TitleCard title="Hearthside" subtitle="a voice-told story" />
          ) : null}

          {inSession ? (
            <View style={styles.waveStack}>
              <View style={styles.laneBlock}>
                <WaveformBar
                  level={agentLevel}
                  color={colors.accentAmber}
                  active={status === 'narrating'}
                />
                <Text style={styles.laneLabel}>narrator</Text>
              </View>

              <View style={styles.laneBlock}>
                <WaveformBar
                  level={muted ? 0 : micLevel}
                  color={colors.accentSlate}
                  active={!muted}
                />
                <View style={styles.laneFoot}>
                  <Text style={styles.laneLabel}>you</Text>
                  {micChunksSent > 0 ? (
                    <View style={styles.txPill}>
                      <View
                        style={[
                          styles.txDot,
                          {
                            backgroundColor: muted
                              ? colors.danger
                              : micChunksSent % 2 === 0
                                ? colors.accentSlate
                                : colors.divider,
                          },
                        ]}
                      />
                      <Text style={styles.txText}>
                        {muted ? 'muted' : `sending · ${micChunksSent}`}
                      </Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={toggleMute}
                    style={({ pressed }) => [
                      styles.muteBtn,
                      muted && styles.muteBtnOn,
                      pressed && { opacity: 0.7 },
                    ]}
                    hitSlop={8}
                  >
                    <Text
                      style={[
                        styles.muteBtnText,
                        muted && styles.muteBtnTextOn,
                      ]}
                    >
                      {muted ? 'unmute' : 'mute'}
                    </Text>
                  </Pressable>
                </View>
              </View>
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

      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        serverUrl={TOKEN_SERVER_URL}
      />
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
  gearBtn: {
    position: 'absolute',
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  gearText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48,
  },
  waveStack: {
    gap: 32,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  laneBlock: {
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  laneLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 11,
  },
  laneFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  txPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  txDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  txText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 10,
  },
  muteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  muteBtnOn: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  muteBtnText: {
    ...typography.label,
    color: colors.textPrimary,
    fontSize: 10,
  },
  muteBtnTextOn: {
    color: colors.bg,
  },
  errorWrap: {
    alignSelf: 'stretch',
  },
  bottomSlot: {
    alignItems: 'center',
  },
});
