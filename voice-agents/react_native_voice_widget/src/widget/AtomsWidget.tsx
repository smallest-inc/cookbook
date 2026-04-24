import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAtomsSession } from '@/hooks/useAtomsSession';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { WidgetSheet } from './WidgetSheet';
import { Transcript } from './Transcript';
import { StatusLine } from './StatusLine';
import { Waveform } from './Waveform';
import { ActionRow } from './ActionRow';

/**
 * Drop-in voice-agent widget. Renders a small floating "Ask AI" pill in the
 * bottom-right corner of the host screen. Tap → slides up a bottom sheet
 * with a live session: transcript, status, waveform, and a mic button.
 *
 * Consumer:
 *   <AtomsWidget apiKey={KEY} agentId={ID} />
 *
 * The pill and sheet are pointer-events-scoped; the host app below them keeps
 * receiving gestures. No full-screen takeover.
 */
export interface AtomsWidgetProps {
  apiKey: string | undefined;
  agentId: string | undefined;
  /** Label on the pill. Defaults to "Ask AI". */
  label?: string;
}

export function AtomsWidget({ apiKey, agentId, label = 'Ask AI' }: AtomsWidgetProps) {
  const [open, setOpen] = useState(false);
  const session = useAtomsSession({ apiKey, agentId });
  const { status, start, stop } = session;

  // Session tracks the sheet's visibility. One rule callers reason about:
  // open sheet ⇒ session alive. Pulling `start`/`stop` out explicitly keeps
  // React's exhaustive-deps rule satisfied; both are stable useCallback refs.
  useEffect(() => {
    if (open && status === 'idle') start();
    else if (!open && status !== 'idle') stop();
  }, [open, status, start, stop]);

  const activeLevel = session.status === 'narrating' ? session.agentLevel : session.micLevel;
  const waveformActive = session.status === 'narrating' ||
    (session.status === 'listening' && !session.muted) ||
    (session.status === 'joined' && !session.muted);

  return (
    <>
      <WidgetPill label={label} onPress={() => setOpen(true)} />

      <WidgetSheet visible={open} onRequestClose={() => setOpen(false)}>
        <Transcript entries={session.transcript} />

        <View style={styles.center}>
          <StatusLine status={session.status} />
          <Waveform level={activeLevel} active={waveformActive} />
        </View>

        <ActionRow
          active={session.status !== 'idle' && session.status !== 'error'}
          muted={session.muted}
          onMicPress={session.toggleMute}
          onClosePress={() => setOpen(false)}
        />

        {session.error ? (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>{session.error.message}</Text>
            {session.error.retryable ? (
              <Pressable onPress={() => { session.stop(); session.start(); }}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </WidgetSheet>
    </>
  );
}

// Floating pill — sits bottom-right, above the host app's content but
// pointer-events contained to itself so the rest of the screen is interactive.
function WidgetPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <View pointerEvents="box-none" style={styles.pillContainer}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.pill, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.pillDot} />
        <Text style={styles.pillText}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pillContainer: {
    position: 'absolute',
    right: 20, bottom: 28,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.ink,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pillDot: {
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: colors.teal,
  },
  pillText: {
    ...typography.label,
    color: colors.textOnDark,
    letterSpacing: 0.2,
  },
  center: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  errorText: {
    ...typography.meta,
    color: colors.coral,
    flex: 1,
    marginRight: 12,
  },
  retryText: {
    ...typography.label,
    color: colors.teal,
  },
});
