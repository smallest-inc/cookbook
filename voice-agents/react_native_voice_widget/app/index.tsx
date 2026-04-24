import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AtomsWidget } from '@/widget/AtomsWidget';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

// EXPO_PUBLIC_* are inlined into the JS bundle at build time by Metro.
const API_KEY  = process.env.EXPO_PUBLIC_SMALLEST_API_KEY;
const AGENT_ID = process.env.EXPO_PUBLIC_AGENT_ID;

/**
 * Host demo — a fake clinic receptionist dashboard. The AtomsWidget is
 * dropped in at the end of the tree; it renders as a floating pill and
 * does not take over the screen. Use this as a template when integrating
 * the widget into your own app.
 */
export default function HostDemoApp() {
  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Header />

          <Section label="Today · 24 Apr">
            <AppointmentCard
              time="09:00"
              patient="Ada Lovelace"
              reason="Annual checkup"
              status="Checked in"
            />
            <AppointmentCard
              time="09:30"
              patient="Grace Hopper"
              reason="Blood work review"
              status="Arrived"
              highlighted
            />
            <AppointmentCard
              time="10:15"
              patient="Alan Turing"
              reason="Cardiology follow-up"
              status="Pending"
            />
            <AppointmentCard
              time="11:00"
              patient="Marie Curie"
              reason="Lab results"
              status="Pending"
            />
          </Section>

          <Section label="Quick links">
            <LinkRow icon="📅" label="Full calendar" />
            <LinkRow icon="👥" label="Patient directory" />
            <LinkRow icon="📊" label="Today's metrics" />
            <LinkRow icon="⚙️" label="Settings" />
          </Section>

          <View style={{ height: 140 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Widget lives in the tree alongside the host content. Floats on top. */}
      <AtomsWidget apiKey={API_KEY} agentId={AGENT_ID} label="Ask AI" />
    </View>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <View>
        <Text style={typography.caption}>MYCLINIC · RECEPTION</Text>
        <Text style={styles.greeting}>Good morning, Dr. Rao</Text>
      </View>
      <View style={styles.avatar}>
        <Text style={styles.avatarInitials}>SR</Text>
      </View>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

function AppointmentCard({
  time, patient, reason, status, highlighted,
}: { time: string; patient: string; reason: string; status: string; highlighted?: boolean }) {
  return (
    <View style={[styles.card, highlighted && styles.cardHighlighted]}>
      <View style={styles.cardTimeCol}>
        <Text style={styles.cardTime}>{time}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.cardPatient}>{patient}</Text>
        <Text style={styles.cardReason}>{reason}</Text>
      </View>
      <View style={[styles.statusPill, highlighted && styles.statusPillActive]}>
        <Text style={[styles.statusText, highlighted && { color: colors.ink }]}>{status}</Text>
      </View>
    </View>
  );
}

function LinkRow({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.linkRow}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={styles.linkLabel}>{label}</Text>
      <Text style={styles.linkChevron}>›</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 24 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  greeting: {
    ...typography.heading,
    color: colors.ink,
    fontSize: 22,
    marginTop: 4,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.tealSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: {
    ...typography.bodyStrong,
    color: colors.teal,
    fontSize: 13,
  },

  section: { gap: 10 },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  cardHighlighted: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.teal,
  },
  cardTimeCol: {
    width: 54,
  },
  cardTime: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  cardPatient: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  cardReason: {
    ...typography.meta,
    color: colors.textMuted,
  },
  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  statusPillActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  statusText: {
    ...typography.meta,
    fontSize: 11,
    color: colors.textSecondary,
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  linkLabel: {
    ...typography.bodyStrong,
    color: colors.ink,
    flex: 1,
  },
  linkChevron: {
    ...typography.heading,
    color: colors.textMuted,
    fontSize: 22,
  },
});
