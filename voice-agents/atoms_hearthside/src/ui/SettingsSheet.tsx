import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import {
  AgentSnapshot,
  fetchAgent,
  updateAgentConfig,
} from '@/agent/atomsRest';

// Curated v3.1 voices. These are stable catalog IDs that ship on every
// org. For a full picker fetch GET /waves/v1/voices, but for a cookbook
// demo an opinionated shortlist is friendlier.
const VOICES: { id: string; label: string }[] = [
  { id: 'magnus',   label: 'Magnus (warm British male)' },
  { id: 'daniel',   label: 'Daniel (neutral male)' },
  { id: 'emily',    label: 'Emily (friendly female)' },
  { id: 'sophia',   label: 'Sophia (professional female)' },
  { id: 'arjun',    label: 'Arjun (Indian English male)' },
  { id: 'priya',    label: 'Priya (Indian English female)' },
];

const LANGS: { code: string; label: string }[] = [
  { code: 'en',    label: 'English' },
  { code: 'hi',    label: 'Hindi' },
  { code: 'multi', label: 'Multi (auto-detect)' },
];

const SPEEDS = [0.85, 1.0, 1.15, 1.3];

export interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  apiKey: string | undefined;
  agentId: string | undefined;
  // Called after a successful apply. Parent may choose to restart session.
  onApplied?: () => void;
}

export function SettingsSheet(props: SettingsSheetProps) {
  const { visible, onClose, apiKey, agentId, onApplied } = props;

  const [snapshot, setSnapshot] = useState<AgentSnapshot | null>(null);
  const [voiceId, setVoiceId] = useState<string>('');
  const [speed, setSpeed] = useState<number>(1.0);
  const [language, setLanguage] = useState<string>('en');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (!visible || !apiKey || !agentId) return;
    setErr(null);
    setApplied(false);
    setLoading(true);
    fetchAgent(apiKey, agentId)
      .then((s) => {
        setSnapshot(s);
        setVoiceId(s.voiceId);
        setSpeed(s.speed);
        setLanguage(s.language);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'failed to load'))
      .finally(() => setLoading(false));
  }, [visible, apiKey, agentId]);

  const dirty =
    snapshot !== null &&
    (voiceId !== snapshot.voiceId ||
      speed !== snapshot.speed ||
      language !== snapshot.language);

  const apply = async () => {
    if (!apiKey || !agentId || !snapshot || !dirty) return;
    setApplying(true);
    setErr(null);
    try {
      await updateAgentConfig(apiKey, agentId, snapshot, {
        voiceId,
        speed,
        language,
      });
      setApplied(true);
      setSnapshot({ ...snapshot, voiceId, speed, language });
      onApplied?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'apply failed');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Agent Settings</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accentSlate} />
              <Text style={styles.hint}>Loading current config…</Text>
            </View>
          ) : err && !snapshot ? (
            <View style={styles.center}>
              <Text style={styles.error}>{err}</Text>
            </View>
          ) : snapshot ? (
            <ScrollView contentContainerStyle={styles.body}>
              <Text style={styles.agentName} numberOfLines={1}>
                {snapshot.name}
              </Text>

              <Section label="Voice">
                <View style={styles.chipWrap}>
                  {VOICES.map((v) => (
                    <ChipOption
                      key={v.id}
                      label={v.label}
                      selected={voiceId === v.id}
                      onPress={() => setVoiceId(v.id)}
                    />
                  ))}
                  {!VOICES.find((v) => v.id === voiceId) ? (
                    <ChipOption
                      label={`custom: ${voiceId}`}
                      selected
                      onPress={() => {}}
                    />
                  ) : null}
                </View>
              </Section>

              <Section label="Speed">
                <View style={styles.chipWrap}>
                  {SPEEDS.map((s) => (
                    <ChipOption
                      key={s}
                      label={`${s.toFixed(2)}×`}
                      selected={Math.abs(speed - s) < 0.01}
                      onPress={() => setSpeed(s)}
                    />
                  ))}
                </View>
              </Section>

              <Section label="Language">
                <View style={styles.chipWrap}>
                  {LANGS.map((l) => (
                    <ChipOption
                      key={l.code}
                      label={l.label}
                      selected={language === l.code}
                      onPress={() => setLanguage(l.code)}
                    />
                  ))}
                </View>
              </Section>

              {err ? <Text style={styles.error}>{err}</Text> : null}
              {applied ? (
                <Text style={styles.okText}>
                  Saved. End the current story and begin again to hear the new
                  voice.
                </Text>
              ) : null}

              <Pressable
                disabled={!dirty || applying}
                onPress={apply}
                style={({ pressed }) => [
                  styles.applyBtn,
                  (!dirty || applying) && styles.applyBtnDisabled,
                  pressed && { opacity: 0.7 },
                ]}
              >
                {applying ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <Text style={styles.applyText}>
                    {dirty ? 'Apply & publish' : 'No changes'}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Section(props: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{props.label}</Text>
      {props.children}
    </View>
  );
}

function ChipOption(props: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.chip,
        props.selected && styles.chipSelected,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text
        style={[styles.chipText, props.selected && styles.chipTextSelected]}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  title: {
    ...typography.subtitle,
    fontStyle: 'normal',
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  close: {
    ...typography.label,
    color: colors.accentSlate,
    fontSize: 13,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 20,
  },
  agentName: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  chipSelected: {
    backgroundColor: colors.accentSlate,
    borderColor: colors.accentSlate,
  },
  chipText: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 13,
  },
  chipTextSelected: {
    color: colors.bg,
    fontWeight: '600',
  },
  applyBtn: {
    backgroundColor: colors.accentAmber,
    paddingVertical: 14,
    borderRadius: 100,
    alignItems: 'center',
    marginTop: 8,
  },
  applyBtnDisabled: {
    opacity: 0.45,
  },
  applyText: {
    ...typography.body,
    color: colors.bg,
    fontSize: 15,
    fontWeight: '600',
  },
  center: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  hint: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
  },
  error: {
    ...typography.body,
    color: colors.danger,
    fontSize: 12,
  },
  okText: {
    ...typography.body,
    color: colors.accentSlate,
    fontSize: 12,
  },
});
