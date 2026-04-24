import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:record/record.dart';

/// Starts the platform microphone stream and emits base64-encoded Int16 LE
/// PCM chunks at [sampleRate]. Uses the `record` package, which bridges to
/// native PCM capture on iOS / Android / macOS. On Android this maps to
/// `MediaRecorder.AudioSource.VOICE_COMMUNICATION` (AEC + NS engaged); on
/// iOS to `AVAudioSession` record route.
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

  final AudioRecorder _recorder = AudioRecorder();
  StreamSubscription<Uint8List>? _sub;

  Future<void> start() async {
    try {
      final stream = await _recorder.startStream(RecordConfig(
        encoder: AudioEncoder.pcm16bits,
        sampleRate: sampleRate,
        numChannels: 1,
        androidConfig: const AndroidRecordConfig(
          audioSource: AndroidAudioSource.voiceCommunication,
        ),
      ));
      _sub = stream.listen(_onBytes, onError: (Object e) => onError(e.toString()));
    } catch (e) {
      onError('mic start failed: $e');
    }
  }

  Future<void> stop() async {
    await _sub?.cancel();
    _sub = null;
    if (await _recorder.isRecording()) {
      await _recorder.stop();
    }
    await _recorder.dispose();
  }

  void _onBytes(Uint8List bytes) {
    if (mutedProvider()) {
      onChunk('', 0);
      return;
    }
    onChunk(base64Encode(bytes), rmsFromPcm16(bytes));
  }
}

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
