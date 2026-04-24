import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface Props { entries: TranscriptEntry[] }

export function Transcript({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Speak after the assistant greets you. Transcript appears here.
        </Text>
      </View>
    );
  }
  // Render latest at the bottom (reverse renders since list is oldest-first).
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {entries.map((e) => (e.role === 'user' ? <UserRow key={e.id} text={e.text} /> : <AssistantRow key={e.id} text={e.text} />))}
    </ScrollView>
  );
}

function UserRow({ text }: { text: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: colors.divider }]}>
        <View style={userAvatar.head} />
        <View style={userAvatar.body} />
      </View>
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{text}</Text>
      </View>
    </View>
  );
}

function AssistantRow({ text }: { text: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: colors.tealSoft }]}>
        <Sparkle />
      </View>
      <View style={[styles.bubble, { gap: 4 }]}>
        <Text style={styles.roleLabel}>ASSISTANT</Text>
        <Text style={styles.bubbleText}>{text}</Text>
      </View>
    </View>
  );
}

function Sparkle() {
  // Four-pointed star made of two rotated squares — no icon-font dep.
  return (
    <View style={sparkle.wrap}>
      <View style={[sparkle.diamond, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[sparkle.diamond, sparkle.small]} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 180 },
  scrollContent: { gap: 14, paddingBottom: 4 },
  empty: {
    paddingVertical: 22, paddingHorizontal: 8,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.meta,
    color: colors.textMuted,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  bubble: { flex: 1 },
  bubbleText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  roleLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
});

const userAvatar = StyleSheet.create({
  head: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.textSecondary,
    marginBottom: 2,
  },
  body: {
    width: 16, height: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8,
    backgroundColor: colors.textSecondary,
  },
});

const sparkle = StyleSheet.create({
  wrap: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  diamond: {
    position: 'absolute',
    width: 10, height: 10,
    backgroundColor: colors.teal,
  },
  small: {
    width: 4, height: 4,
    top: 1, right: 1,
    transform: [{ rotate: '45deg' }],
  },
});
