import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';

import 'atoms_client.dart';
import 'audio/mic_capture.dart';
import 'audio/pcm_playback.dart';

enum SessionStatus {
  idle,
  connecting,
  joined,
  listening,
  narrating,
  error,
}

class SessionState {
  const SessionState({
    this.status = SessionStatus.idle,
    this.micLevel = 0,
    this.agentLevel = 0,
    this.micChunksSent = 0,
    this.muted = false,
    this.error,
  });

  final SessionStatus status;
  final double micLevel;
  final double agentLevel;
  final int micChunksSent;
  final bool muted;
  final String? error;

  SessionState copyWith({
    SessionStatus? status,
    double? micLevel,
    double? agentLevel,
    int? micChunksSent,
    bool? muted,
    String? error,
    bool clearError = false,
  }) => SessionState(
        status: status ?? this.status,
        micLevel: micLevel ?? this.micLevel,
        agentLevel: agentLevel ?? this.agentLevel,
        micChunksSent: micChunksSent ?? this.micChunksSent,
        muted: muted ?? this.muted,
        error: clearError ? null : (error ?? this.error),
      );
}

/// Owns the agent client + mic + playback lifecycle. Exposes a
/// [ValueListenable] so a StatefulWidget can `ValueListenableBuilder`
/// against it without pulling in a state-management library.
class SessionController {
  SessionController({required this.apiKey, required this.agentId});

  final String apiKey;
  final String agentId;

  final ValueNotifier<SessionState> state = ValueNotifier(const SessionState());
  static const int _sampleRate = 24000;

  AtomsClient? _client;
  MicCapture?  _mic;
  PcmPlayback? _playback;
  StreamSubscription<AtomsServerEvent>? _eventSub;

  Future<void> start() async {
    if (apiKey.isEmpty || agentId.isEmpty) {
      _emitError('Missing ATOMS_API_KEY / ATOMS_AGENT_ID (see README).');
      return;
    }
    state.value = const SessionState(status: SessionStatus.connecting);

    final granted = (await Permission.microphone.request()).isGranted;
    if (!granted) {
      _emitError('Microphone permission denied.');
      return;
    }

    final playback = PcmPlayback(sampleRate: _sampleRate);
    await playback.start();
    _playback = playback;

    final client = AtomsClient(apiKey: apiKey, agentId: agentId, sampleRate: _sampleRate);
    _client = client;
    _eventSub = client.events.listen(_handleEvent);
    await client.start();

    final mic = MicCapture(
      sampleRate: _sampleRate,
      mutedProvider: () => state.value.muted,
      onChunk: (b64, rms) {
        if (b64.isEmpty) {
          state.value = state.value.copyWith(micLevel: 0);
          return;
        }
        client.sendMicChunk(b64);
        state.value = state.value.copyWith(
          micLevel: rms,
          micChunksSent: state.value.micChunksSent + 1,
        );
      },
      onError: (msg) => _emitError(msg),
    );
    _mic = mic;
    await mic.start();
  }

  Future<void> stop() async {
    await _mic?.stop(); _mic = null;
    await _playback?.stop(); _playback = null;
    await _eventSub?.cancel(); _eventSub = null;
    await _client?.close(); _client = null;
    state.value = const SessionState();
  }

  void toggleMute() {
    final muted = !state.value.muted;
    state.value = state.value.copyWith(muted: muted, micLevel: muted ? 0 : state.value.micLevel);
  }

  Future<void> _handleEvent(AtomsServerEvent event) async {
    switch (event) {
      case SessionCreated():
        state.value = state.value.copyWith(status: SessionStatus.joined);
      case OutputAudioDelta():
        await _playback?.enqueueBase64(event.base64);
        state.value = state.value.copyWith(agentLevel: rmsFromBase64(event.base64));
      case AgentStartTalking():
        state.value = state.value.copyWith(status: SessionStatus.narrating);
      case AgentStopTalking():
        state.value = state.value.copyWith(status: SessionStatus.listening, agentLevel: 0);
      case Interruption():
        await _playback?.flush();
        state.value = state.value.copyWith(agentLevel: 0);
      case SessionClosed():
        await stop();
      case ServerError():
        _emitError('${event.code}: ${event.message}');
    }
  }

  void _emitError(String message) {
    unawaited(_mic?.stop());       _mic = null;
    unawaited(_playback?.stop());  _playback = null;
    unawaited(_eventSub?.cancel()); _eventSub = null;
    unawaited(_client?.close());   _client = null;
    state.value = SessionState(status: SessionStatus.error, error: message);
  }
}

double rmsFromBase64(String b64) {
  try {
    final bytes = base64.decode(b64);
    return rmsFromPcm16(bytes);
  } catch (_) {
    return 0;
  }
}
