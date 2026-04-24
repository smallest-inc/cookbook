import 'dart:async';

import 'package:flutter/material.dart';

import '../session_controller.dart';
import '../theme/brand.dart';

/// Drop-in voice-agent widget. Renders a floating "Ask AI" pill bottom-right
/// of the host screen. Tap → bottom sheet with a live voice session. Host
/// app keeps rendering underneath.
///
/// Consumer:
///   Stack(children: [
///     YourHostScreen(),
///     AtomsWidget(apiKey: KEY, agentId: ID),
///   ])
class AtomsWidget extends StatefulWidget {
  const AtomsWidget({
    super.key,
    required this.apiKey,
    required this.agentId,
    this.label = 'Ask AI',
  });

  final String apiKey;
  final String agentId;
  final String label;

  @override
  State<AtomsWidget> createState() => _AtomsWidgetState();
}

class _AtomsWidgetState extends State<AtomsWidget> {
  SessionController? _session;

  @override
  void dispose() {
    _session?.stop();
    super.dispose();
  }

  Future<void> _openSheet(BuildContext context) async {
    // One session per sheet open. Cleaned up on sheet dismiss.
    final session = SessionController(apiKey: widget.apiKey, agentId: widget.agentId);
    setState(() => _session = session);
    unawaited(session.start());

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Brand.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _Sheet(session: session),
    );

    await session.stop();
    if (mounted) setState(() => _session = null);
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Positioned(
          right: 20,
          bottom: 28,
          child: _Pill(label: widget.label, onTap: () => _openSheet(context)),
        ),
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        decoration: BoxDecoration(
          color: Brand.ink,
          borderRadius: BorderRadius.circular(100),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 10, offset: const Offset(0, 4)),
          ],
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 9, height: 9,
            decoration: const BoxDecoration(color: Brand.teal, shape: BoxShape.circle)),
          const SizedBox(width: 10),
          Text(label, style: const TextStyle(
            color: Brand.textOnDark, fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: 0.2)),
        ]),
      ),
    );
  }
}

class _Sheet extends StatelessWidget {
  const _Sheet({required this.session});
  final SessionController session;

  @override
  Widget build(BuildContext context) {
    return FractionallySizedBox(
      heightFactor: 0.55,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: ValueListenableBuilder<SessionState>(
          valueListenable: session.state,
          builder: (_, s, __) {
            return Column(
              mainAxisSize: MainAxisSize.max,
              children: [
                const SizedBox(height: 10),
                Container(width: 44, height: 5,
                  decoration: BoxDecoration(color: Brand.divider, borderRadius: BorderRadius.circular(3))),
                const SizedBox(height: 10),
                Expanded(child: _transcriptPlaceholder),
                _StatusLine(status: s.status),
                const SizedBox(height: 14),
                _Waveform(level: _activeLevel(s), active: _active(s)),
                const Spacer(),
                _ActionRow(
                  muted: s.muted,
                  onMic: session.toggleMute,
                  onClose: () => Navigator.of(context).maybePop(),
                ),
                if (s.error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(s.error!,
                      style: const TextStyle(color: Brand.coral, fontSize: 12),
                      textAlign: TextAlign.center),
                  ),
                const SizedBox(height: 24),
              ],
            );
          },
        ),
      ),
    );
  }

  static final _transcriptPlaceholder = Center(
    child: Text(
      'Speak after the assistant greets you. Transcript appears here.',
      style: TextStyle(color: Brand.textMuted, fontSize: 12),
      textAlign: TextAlign.center,
    ),
  );

  static double _activeLevel(SessionState s) =>
      s.status == SessionStatus.narrating ? s.agentLevel : s.micLevel;

  static bool _active(SessionState s) {
    switch (s.status) {
      case SessionStatus.narrating: return true;
      case SessionStatus.listening:
      case SessionStatus.joined: return !s.muted;
      default: return false;
    }
  }
}

class _StatusLine extends StatelessWidget {
  const _StatusLine({required this.status});
  final SessionStatus status;

  String get _label {
    switch (status) {
      case SessionStatus.idle:         return 'Tap the mic to start';
      case SessionStatus.connecting:   return 'Connecting…';
      case SessionStatus.joined:       return 'Assistant joined';
      case SessionStatus.listening:    return 'Listening';
      case SessionStatus.narrating:    return 'Speaking';
      case SessionStatus.error:        return 'Something went wrong';
    }
  }
  Color get _dot {
    switch (status) {
      case SessionStatus.idle:         return Brand.divider;
      case SessionStatus.connecting:   return Brand.gold;
      case SessionStatus.joined:
      case SessionStatus.listening:
      case SessionStatus.narrating:    return Brand.teal;
      case SessionStatus.error:        return Brand.coral;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisAlignment: MainAxisAlignment.center, children: [
      Container(width: 8, height: 8, decoration: BoxDecoration(color: _dot, shape: BoxShape.circle)),
      const SizedBox(width: 8),
      Text(_label, style: const TextStyle(color: Brand.teal, fontSize: 15, fontWeight: FontWeight.w600)),
    ]);
  }
}

class _Waveform extends StatelessWidget {
  const _Waveform({required this.level, required this.active});
  final double level;
  final bool active;
  static const _bars = 9;
  static const _minH = 4.0;
  static const _maxH = 26.0;

  @override
  Widget build(BuildContext context) {
    final normalized = (level * 3).clamp(0.0, 1.0);
    return SizedBox(
      height: _maxH + 4,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: List.generate(_bars, (i) {
          final weight = 1 - (i - (_bars - 1) / 2).abs() / ((_bars - 1) / 2);
          final h = active
              ? (_minH + (_minH + weight * (_maxH - _minH)) * normalized + weight * 3)
                  .clamp(_minH, _maxH)
              : _minH;
          return Padding(
            padding: EdgeInsets.symmetric(horizontal: i == 0 ? 0 : 2),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 110),
              width: 3,
              height: h.toDouble(),
              decoration: BoxDecoration(
                color: active ? Brand.teal : Brand.divider,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({required this.muted, required this.onMic, required this.onClose});
  final bool muted;
  final VoidCallback onMic;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _CircleIcon(icon: Icons.keyboard_alt_outlined, enabled: false, onTap: () {}),
          _MicButton(muted: muted, onTap: onMic),
          _CircleIcon(icon: Icons.close, onTap: onClose),
        ],
      ),
    );
  }
}

class _CircleIcon extends StatelessWidget {
  const _CircleIcon({required this.icon, required this.onTap, this.enabled = true});
  final IconData icon;
  final VoidCallback onTap;
  final bool enabled;
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        width: 44, height: 44,
        decoration: const BoxDecoration(color: Brand.surfaceAlt, shape: BoxShape.circle),
        child: Icon(icon, color: enabled ? Brand.textSecondary : Brand.textMuted, size: 18),
      ),
    );
  }
}

class _MicButton extends StatefulWidget {
  const _MicButton({required this.muted, required this.onTap});
  final bool muted;
  final VoidCallback onTap;
  @override
  State<_MicButton> createState() => _MicButtonState();
}

class _MicButtonState extends State<_MicButton> with SingleTickerProviderStateMixin {
  late final AnimationController _ctl;

  @override
  void initState() {
    super.initState();
    _ctl = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
      ..repeat(reverse: true);
  }
  @override
  void dispose() { _ctl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final bg = widget.muted ? Brand.coral : Brand.teal;
    return GestureDetector(
      onTap: widget.onTap,
      child: SizedBox(
        width: 72, height: 72,
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (!widget.muted)
              AnimatedBuilder(
                animation: _ctl,
                builder: (_, __) => Container(
                  width: 64 + _ctl.value * 24,
                  height: 64 + _ctl.value * 24,
                  decoration: BoxDecoration(
                    color: bg.withValues(alpha: 0.45 * (1 - _ctl.value)),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            Container(
              width: 56, height: 56,
              decoration: BoxDecoration(
                color: bg,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 8, offset: const Offset(0, 4)),
                ],
              ),
              child: Icon(widget.muted ? Icons.mic_off : Icons.mic,
                color: Brand.textOnDark, size: 24),
            ),
          ],
        ),
      ),
    );
  }
}
