import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:mic_stream/mic_stream.dart';

/// Starts the platform microphone stream and emits base64-encoded Int16 LE
/// PCM chunks at [sampleRate]. On Android the source is
/// `MediaRecorder.AudioSource.VOICE_COMMUNICATION` which engages the AEC+NS
/// pipeline. On iOS the default capture path is used; configure
/// AVAudioSession via `audio_session` if you want echo cancellation there.
class MicCapture {
  MicCapture({
    required this.sampleRate,
    required this.onChunk,
    required this.onError,
    required this.mutedProvider,
  });

  final int sampleRate;
  final void Function(String base64, double rms) onChunk;
  final void Function(String message) onError;
  final bool Function() mutedProvider;

  StreamSubscription<Uint8List>? _sub;

  Future<void> start() async {
    try {
      final stream = MicStream.microphone(
        audioSource: AudioSource.VOICE_COMMUNICATION,
        sampleRate: sampleRate,
        channelConfig: ChannelConfig.CHANNEL_IN_MONO,
        audioFormat: AudioFormat.ENCODING_PCM_16BIT,
      );
      _sub = stream.listen(_onBytes, onError: (Object e) => onError(e.toString()));
    } catch (e) {
      onError('mic start failed: $e');
    }
  }

  Future<void> stop() async {
    await _sub?.cancel();
    _sub = null;
  }

  void _onBytes(Uint8List bytes) {
    if (mutedProvider()) {
      onChunk('', 0);
      return;
    }
    final rms = _rmsPcm16(bytes);
    onChunk(base64Encode(bytes), rms);
  }

  static double _rmsPcm16(Uint8List bytes) {
    if (bytes.length < 2) return 0;
    final frames = bytes.length ~/ 2;
    double sum = 0;
    final data = ByteData.view(bytes.buffer, bytes.offsetInBytes, bytes.lengthInBytes);
    for (var i = 0; i < frames; i++) {
      final s = data.getInt16(i * 2, Endian.little) / 32768.0;
      sum += s * s;
    }
    return (sum / frames).abs().toDouble(); // actually sqrt below
  }
}

// Keeping helper here rather than in the class so tests can reach it.
double rmsFromPcm16(Uint8List bytes) {
  if (bytes.length < 2) return 0;
  final frames = bytes.length ~/ 2;
  double sum = 0;
  final data = ByteData.view(bytes.buffer, bytes.offsetInBytes, bytes.lengthInBytes);
  for (var i = 0; i < frames; i++) {
    final s = data.getInt16(i * 2, Endian.little) / 32768.0;
    sum += s * s;
  }
  return (sum / frames).clamp(0.0, 1.0);
}
