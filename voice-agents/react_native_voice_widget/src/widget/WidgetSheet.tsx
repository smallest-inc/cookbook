import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';

interface Props {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
}

// Bottom-sheet shell. No external bottom-sheet lib — uses Modal + a simple
// slide/fade animation so consumers don't have to add @gorhom/bottom-sheet
// or react-native-reanimated to their host app.
export function WidgetSheet({ visible, onRequestClose, children }: Props) {
  // Re-reads on rotation so the off-screen position tracks the new height.
  const { height: screenH } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(screenH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: visible ? 0 : screenH,
        duration: visible ? 260 : 180,
        easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 200 : 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateY, backdropOpacity, screenH]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onRequestClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} />
        </Animated.View>

        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }]}
        >
          <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.surface }}>
            <View style={styles.grabber} />
            <View style={styles.body}>
              {children}
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(9, 32, 35, 0.35)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },
  grabber: {
    alignSelf: 'center',
    width: 44, height: 5, borderRadius: 3,
    backgroundColor: colors.divider,
    marginTop: 10, marginBottom: 6,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 18,
  },
});
