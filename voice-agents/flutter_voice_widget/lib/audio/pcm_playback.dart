import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_pcm_sound/flutter_pcm_sound.dart';

/// Queues base64 Int16 LE PCM chunks into `flutter_pcm_sound` for gapless
/// scheduled playback. The library keeps an internal ring buffer; calls
/// return immediately without blocking.
class PcmPlayback {
  PcmPlayback({required this.sampleRate});

  final int sampleRate;
  bool _started = false;

  Future<void> start() async {
    if (_started) return;
    await FlutterPcmSound.setup(
      sampleRate: sampleRate,
      channelCount: 1,
    );
    FlutterPcmSound.start();
    _started = true;
  }

  Future<void> enqueueBase64(String b64) async {
    if (!_started) return;
    final bytes = base64Decode(b64);
    if (bytes.length < 2) return;
    final int16 = _int16FromBytes(bytes);
    await FlutterPcmSound.feed(PcmArrayInt16(bytes: int16));
  }

  Future<void> flush() async {
    if (!_started) return;
    await FlutterPcmSound.release();
    _started = false;
    await start();
  }

  Future<void> stop() async {
    if (!_started) return;
    _started = false;
    await FlutterPcmSound.release();
  }

  static ByteData _int16FromBytes(Uint8List bytes) {
    final buf = ByteData(bytes.length);
    buf.buffer.asUint8List().setAll(0, bytes);
    return buf;
  }
}
