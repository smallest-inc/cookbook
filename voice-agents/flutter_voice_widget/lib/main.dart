import 'dart:io';

import 'package:flutter/material.dart';

import 'theme/brand.dart';
import 'widget/atoms_widget.dart';

// Paste your Smallest API key + agent id via --dart-define at build time.
// Falls back to env for headless / CI runs. Do NOT ship keys in a release.
const _apiKey  = String.fromEnvironment('ATOMS_API_KEY');
const _agentId = String.fromEnvironment('ATOMS_AGENT_ID');

void main() {
  final apiKey  = _apiKey.isNotEmpty  ? _apiKey  : (Platform.environment['ATOMS_API_KEY']  ?? '');
  final agentId = _agentId.isNotEmpty ? _agentId : (Platform.environment['ATOMS_AGENT_ID'] ?? '');

  runApp(MaterialApp(
    title: 'MyClinic',
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: Brand.teal, brightness: Brightness.light)
        .copyWith(surface: Brand.surface),
      scaffoldBackgroundColor: Brand.surface,
    ),
    debugShowCheckedModeBanner: false,
    home: Scaffold(
      backgroundColor: Brand.surface,
      body: Stack(
        fit: StackFit.expand,
        children: [
          const SafeArea(child: HostDashboard()),
          // Widget is a sibling of the host content. Its pill is positioned
          // absolutely so host gestures still land on appointment cards etc.
          AtomsWidget(apiKey: apiKey, agentId: agentId, label: 'Ask AI'),
        ],
      ),
    ),
  ));
}

class HostDashboard extends StatelessWidget {
  const HostDashboard({super.key});
  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _Header(),
          const SizedBox(height: 24),
          _Section(label: 'TODAY · 24 APR', children: const [
            _Appointment(time: '09:00', name: 'Ada Lovelace',
              reason: 'Annual checkup', status: 'Checked in'),
            SizedBox(height: 10),
            _Appointment(time: '09:30', name: 'Grace Hopper',
              reason: 'Blood work review', status: 'Arrived', highlighted: true),
            SizedBox(height: 10),
            _Appointment(time: '10:15', name: 'Alan Turing',
              reason: 'Cardiology follow-up', status: 'Pending'),
            SizedBox(height: 10),
            _Appointment(time: '11:00', name: 'Marie Curie',
              reason: 'Lab results', status: 'Pending'),
          ]),
          const SizedBox(height: 24),
          _Section(label: 'QUICK LINKS', children: const [
            _LinkRow(icon: Icons.calendar_today, label: 'Full calendar'),
            SizedBox(height: 10),
            _LinkRow(icon: Icons.people_outline, label: 'Patient directory'),
            SizedBox(height: 10),
            _LinkRow(icon: Icons.bar_chart, label: "Today's metrics"),
            SizedBox(height: 10),
            _LinkRow(icon: Icons.settings, label: 'Settings'),
          ]),
          const SizedBox(height: 140),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();
  @override
  Widget build(BuildContext context) {
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [
        Text('MYCLINIC · RECEPTION', style: TextStyle(
          color: Brand.textMuted, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1)),
        SizedBox(height: 4),
        Text('Good morning, Dr. Rao', style: TextStyle(
          color: Brand.ink, fontSize: 22, fontWeight: FontWeight.w500)),
      ])),
      Container(
        width: 40, height: 40,
        decoration: const BoxDecoration(color: Brand.tealSoft, shape: BoxShape.circle),
        child: const Center(
          child: Text('SR', style: TextStyle(
            color: Brand.teal, fontSize: 13, fontWeight: FontWeight.w600)),
        ),
      ),
    ]);
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.label, required this.children});
  final String label;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Text(label, style: const TextStyle(
          color: Brand.textMuted, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1)),
      ),
      ...children,
    ]);
  }
}

class _Appointment extends StatelessWidget {
  const _Appointment({
    required this.time, required this.name, required this.reason,
    required this.status, this.highlighted = false,
  });
  final String time;
  final String name;
  final String reason;
  final String status;
  final bool highlighted;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: highlighted ? Brand.tealSoft : Brand.surfaceHighlight,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: highlighted ? Brand.teal : Brand.divider, width: 0.5),
      ),
      child: Row(children: [
        SizedBox(width: 54, child: Text(time, style: const TextStyle(
          color: Brand.ink, fontSize: 15, fontWeight: FontWeight.w600))),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(name, style: const TextStyle(color: Brand.ink, fontSize: 15, fontWeight: FontWeight.w600)),
          Text(reason, style: const TextStyle(color: Brand.textMuted, fontSize: 12)),
        ])),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: highlighted ? Brand.gold : Brand.surface,
            borderRadius: BorderRadius.circular(100),
          ),
          child: Text(status, style: const TextStyle(
            color: Brand.textSecondary, fontSize: 11, fontWeight: FontWeight.w500)),
        ),
      ]),
    );
  }
}

class _LinkRow extends StatelessWidget {
  const _LinkRow({required this.icon, required this.label});
  final IconData icon;
  final String label;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Brand.surfaceHighlight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Brand.divider, width: 0.5),
      ),
      child: Row(children: [
        Icon(icon, color: Brand.inkSoft, size: 20),
        const SizedBox(width: 12),
        Expanded(child: Text(label, style: const TextStyle(
          color: Brand.ink, fontSize: 15, fontWeight: FontWeight.w600))),
        const Icon(Icons.chevron_right, color: Brand.textMuted, size: 22),
      ]),
    );
  }
}
