import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/status.dart' as ws_status;

sealed class AtomsServerEvent {}

class SessionCreated extends AtomsServerEvent {
  final String sessionId;
  final String callId;
  SessionCreated(this.sessionId, this.callId);
}

class OutputAudioDelta extends AtomsServerEvent {
  final String base64;
  OutputAudioDelta(this.base64);
}

class AgentStartTalking extends AtomsServerEvent {}
class AgentStopTalking extends AtomsServerEvent {}
class Interruption extends AtomsServerEvent {}

class SessionClosed extends AtomsServerEvent {
  final String? reason;
  SessionClosed(this.reason);
}

class ServerError extends AtomsServerEvent {
  final String code;
  final String message;
  ServerError(this.code, this.message);
}

/// Thin wrapper around [WebSocketChannel] that decodes server events into a
/// typed stream and auto-retries on transient drops. Does not retry on
/// 4401/4403 close codes (auth failure).
class AtomsClient {
  AtomsClient({
    required this.apiKey,
    required this.agentId,
    this.sampleRate = 24000,
  });

  final String apiKey;
  final String agentId;
  final int sampleRate;

  final _events = StreamController<AtomsServerEvent>.broadcast();
  Stream<AtomsServerEvent> get events => _events.stream;

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _sub;
  bool _closedExplicitly = false;
  int _reconnectAttempt = 0;
  static const _backoffMillis = [500, 1000, 2000, 5000, 15000];
  static const _maxReconnects = 5;

  Future<void> start() async {
    _closedExplicitly = false;
    _connect();
  }

  void sendMicChunk(String base64Int16LE) {
    _channel?.sink.add(jsonEncode({
      'type':  'input_audio_buffer.append',
      'audio': base64Int16LE,
    }));
  }

  Future<void> close() async {
    _closedExplicitly = true;
    await _sub?.cancel();
    await _channel?.sink.close(ws_status.normalClosure, 'client stop');
    _channel = null;
  }

  void _connect() {
    final uri = Uri(
      scheme: 'wss',
      host: 'api.smallest.ai',
      path: '/atoms/v1/agent/connect',
      queryParameters: {
        'token':       apiKey,
        'agent_id':    agentId,
        'mode':        'webcall',
        'sample_rate': sampleRate.toString(),
      },
    );
    _channel = WebSocketChannel.connect(uri);
    _sub = _channel!.stream.listen(
      _onMessage,
      onError: _onError,
      onDone: _onDone,
      cancelOnError: true,
    );
  }

  void _onMessage(dynamic data) {
    // Any successful inbound frame means the reconnect budget should reset.
    _reconnectAttempt = 0;

    final text = data is String ? data : (data is List<int> ? utf8.decode(data) : null);
    if (text == null) return;
    Map<String, dynamic> json;
    try {
      final decoded = jsonDecode(text);
      if (decoded is! Map<String, dynamic>) return;
      json = decoded;
    } catch (_) {
      return;
    }
    switch (json['type']) {
      case 'session.created':
        _events.add(SessionCreated(
          json['session_id']?.toString() ?? '',
          json['call_id']?.toString() ?? '',
        ));
      case 'output_audio.delta':
        final b64 = json['audio']?.toString();
        if (b64 != null) _events.add(OutputAudioDelta(b64));
      case 'agent_start_talking':
        _events.add(AgentStartTalking());
      case 'agent_stop_talking':
        _events.add(AgentStopTalking());
      case 'interruption':
        _events.add(Interruption());
      case 'session.closed':
        _events.add(SessionClosed(json['reason']?.toString()));
      case 'error':
        _events.add(ServerError(
          json['code']?.toString() ?? '',
          json['message']?.toString() ?? '',
        ));
    }
  }

  void _onError(Object error, [StackTrace? stack]) {
    if (_closedExplicitly) return;
    _retryOrFail();
  }

  void _onDone() {
    final code = _channel?.closeCode;
    if (_closedExplicitly) return;
    if (code == 4401 || code == 4403) {
      _events.add(ServerError(code.toString(), 'auth rejected'));
      return;
    }
    _retryOrFail();
  }

  void _retryOrFail() {
    if (_reconnectAttempt >= _maxReconnects) {
      _events.add(ServerError('network', 'reconnect gave up after $_maxReconnects attempts'));
      return;
    }
    final delay = _backoffMillis[_reconnectAttempt.clamp(0, _backoffMillis.length - 1)];
    _reconnectAttempt += 1;
    Future.delayed(Duration(milliseconds: delay), () {
      if (!_closedExplicitly) _connect();
    });
  }
}
