import 'dart:io';

import 'package:flutter/material.dart';

import 'session_controller.dart';
import 'ui/voice_agent_screen.dart';

/// Credentials come from `--dart-define=ATOMS_API_KEY=... ATOMS_AGENT_ID=...`
/// at build time. Falls back to environment variables for CI / headless dev.
const _defineApiKey  = String.fromEnvironment('ATOMS_API_KEY');
const _defineAgentId = String.fromEnvironment('ATOMS_AGENT_ID');

void main() {
  final apiKey  = _defineApiKey.isNotEmpty
      ? _defineApiKey
      : (Platform.environment['ATOMS_API_KEY'] ?? '');
  final agentId = _defineAgentId.isNotEmpty
      ? _defineAgentId
      : (Platform.environment['ATOMS_AGENT_ID'] ?? '');

  final controller = SessionController(apiKey: apiKey, agentId: agentId);

  runApp(MaterialApp(
    title: 'AtomsVoiceAgent',
    theme: ThemeData.dark(useMaterial3: true),
    debugShowCheckedModeBanner: false,
    home: VoiceAgentScreen(controller: controller),
  ));
}
