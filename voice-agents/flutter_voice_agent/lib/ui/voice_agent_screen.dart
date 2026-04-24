import 'package:flutter/material.dart';

import '../session_controller.dart';

class VoiceAgentScreen extends StatefulWidget {
  const VoiceAgentScreen({super.key, required this.controller});
  final SessionController controller;

  @override
  State<VoiceAgentScreen> createState() => _VoiceAgentScreenState();
}

class _VoiceAgentScreenState extends State<VoiceAgentScreen> {
  @override
  void dispose() {
    widget.controller.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    return Scaffold(
      backgroundColor: const Color(0xFF0E0B08),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: ValueListenableBuilder<SessionState>(
            valueListenable: controller.state,
            builder: (_, state, __) {
              return Column(
                children: [
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 44,
                    child: Center(
                      child: state.status.inSession ? _StatusChip(state.status.label) : null,
                    ),
                  ),
                  const Spacer(),
                  if (state.status.inSession)
                    ..._sessionBody(controller, state)
                  else if (state.status == SessionStatus.error)
                    _ErrorBanner(
                      message: state.error ?? 'error',
                      onDismiss: controller.stop,
                    )
                  else
                    Column(
                      children: const [
                        Text('AtomsVoiceAgent',
                            style: TextStyle(color: Color(0xFFF0E8DA), fontSize: 36)),
                        SizedBox(height: 4),
                        Text('a voice session',
                            style: TextStyle(color: Color(0xFF8B8278), fontSize: 16)),
                      ],
                    ),
                  const Spacer(),
                  _CallButton(
                    label: state.status.inSession
                        ? 'End session'
                        : (state.error != null ? 'Try again' : 'Begin session'),
                    danger: state.status.inSession,
                    onTap: () async {
                      if (state.status.inSession) {
                        await controller.stop();
                      } else {
                        await controller.start();
                      }
                    },
                  ),
                  const SizedBox(height: 32),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  List<Widget> _sessionBody(SessionController controller, SessionState state) {
    return [
      _LaneBlock(
        title: 'narrator',
        level: state.agentLevel,
        color: const Color(0xFFDB984A),
        active: state.status == SessionStatus.narrating,
      ),
      const SizedBox(height: 32),
      _LaneBlock(
        title: state.muted ? 'you — muted' : 'you',
        level: state.muted ? 0 : state.micLevel,
        color: const Color(0xFF7CB8B5),
        active: !state.muted,
        footer: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (state.micChunksSent > 0) _SendingPill(state.muted, state.micChunksSent),
            const SizedBox(width: 8),
            _MuteButton(muted: state.muted, onTap: controller.toggleMute),
          ],
        ),
      ),
    ];
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(this.label);
  final String label;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(100),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8, height: 8,
            decoration: const BoxDecoration(
              color: Color(0xFFDB984A), shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _LaneBlock extends StatelessWidget {
  const _LaneBlock({
    required this.title,
    required this.level,
    required this.color,
    required this.active,
    this.footer,
  });
  final String title;
  final double level;
  final Color color;
  final bool active;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _Waveform(level: level, color: color, active: active),
        const SizedBox(height: 8),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title, style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.5),
            )),
            if (footer != null) ...[const SizedBox(width: 10), footer!],
          ],
        ),
      ],
    );
  }
}

class _Waveform extends StatelessWidget {
  const _Waveform({required this.level, required this.color, required this.active});
  final double level;
  final Color color;
  final bool active;
  @override
  Widget build(BuildContext context) {
    final normalized = (level * 3.2).clamp(0.0, 1.0);
    final heightFactor = active ? normalized.clamp(0.06, 1.0) : 0.06;
    return SizedBox(
      width: 220, height: 48,
      child: Center(
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 80),
          width: 220,
          height: 48 * heightFactor,
          decoration: BoxDecoration(
            color: active ? color.withValues(alpha: 0.9) : Colors.white.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(6),
          ),
        ),
      ),
    );
  }
}

class _SendingPill extends StatelessWidget {
  const _SendingPill(this.muted, this.count);
  final bool muted;
  final int count;
  @override
  Widget build(BuildContext context) {
    final dotColor = muted
        ? const Color(0xFFFF5F52)
        : (count % 2 == 0 ? const Color(0xFF7CB8B5) : Colors.white.withValues(alpha: 0.2));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(100),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 6, height: 6,
              decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Text(muted ? 'muted' : 'sending · $count',
              style: TextStyle(
                fontSize: 10, fontWeight: FontWeight.w600,
                color: Colors.white.withValues(alpha: 0.5),
              )),
        ],
      ),
    );
  }
}

class _MuteButton extends StatelessWidget {
  const _MuteButton({required this.muted, required this.onTap});
  final bool muted;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: muted ? const Color(0xFFFF5F52) : Colors.transparent,
          borderRadius: BorderRadius.circular(100),
          border: Border.all(color: muted ? const Color(0xFFFF5F52) : Colors.white.withValues(alpha: 0.15)),
        ),
        child: Text(muted ? 'unmute' : 'mute',
            style: TextStyle(
              fontSize: 10, fontWeight: FontWeight.w600,
              color: muted ? Colors.black : Colors.white,
            )),
      ),
    );
  }
}

class _CallButton extends StatelessWidget {
  const _CallButton({required this.label, required this.danger, required this.onTap});
  final String label;
  final bool danger;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final color = danger ? const Color(0xFFFF5F52) : const Color(0xFFDB984A);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 14),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(100),
        ),
        child: Text(label,
            style: const TextStyle(color: Colors.black, fontSize: 16, fontWeight: FontWeight.w600)),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onDismiss});
  final String message;
  final VoidCallback onDismiss;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFF5F52).withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('AGENT REPORTED AN ERROR',
              style: TextStyle(color: Color(0xFFFF5F52), fontSize: 11, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text(message, style: TextStyle(color: Colors.white.withValues(alpha: 0.85))),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: onDismiss,
              child: Text('Dismiss', style: TextStyle(color: Colors.white.withValues(alpha: 0.6))),
            ),
          ),
        ],
      ),
    );
  }
}
