import 'package:flutter/material.dart';

import 'models/chore.dart';
import 'models/family_member.dart';
import 'state/homejoy_state.dart';
import 'ui/weather_dashboard_view.dart';

void main() {
  runApp(const HomeJoyApp());
}

class HomeJoyApp extends StatelessWidget {
  const HomeJoyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();

    final chores = [
      Chore(
        id: 'c1',
        title: 'Water plants',
        weight: 3,
        assignedMemberId: 'm1',
        dueAt: now.subtract(const Duration(hours: 30)),
      ),
      Chore(
        id: 'c2',
        title: 'Fold laundry',
        weight: 4,
        assignedMemberId: 'm2',
        dueAt: now.subtract(const Duration(hours: 8)),
      ),
      Chore(
        id: 'c3',
        title: 'Clean table',
        weight: 2,
        assignedMemberId: 'm3',
        dueAt: now.subtract(const Duration(hours: 3)),
      ),
      Chore(
        id: 'c4',
        title: 'Take out trash',
        weight: 5,
        assignedMemberId: 'm1',
        dueAt: now.subtract(const Duration(hours: 27)),
      ),
    ];

    const familyMembers = [
      FamilyMember(id: 'm1', name: 'Alex', avatarEmoji: '🦊'),
      FamilyMember(id: 'm2', name: 'Jamie', avatarEmoji: '🐼'),
      FamilyMember(id: 'm3', name: 'Kai', avatarEmoji: '🐨'),
    ];

    final appState = HomeJoyState(
      chores: chores,
      familyMembers: familyMembers,
    );

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        fontFamily: 'SF Pro Text',
        brightness: Brightness.dark,
      ),
      home: WeatherDashboardView(state: appState),
    );
  }
}
