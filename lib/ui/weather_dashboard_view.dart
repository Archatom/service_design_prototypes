import 'dart:ui';

import 'package:flutter/material.dart';

import '../models/chore.dart';
import '../models/family_member.dart';
import '../models/swap_proposal.dart';
import '../models/weather_state.dart';
import '../state/homejoy_state.dart';

class WeatherDashboardView extends StatelessWidget {
  const WeatherDashboardView({
    super.key,
    required this.state,
  });

  final HomeJoyState state;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: state,
      builder: (context, _) {
        final chores = state.chores;
        final weatherState = state.weatherState;
        final score = state.harmonyScore;
        final weatherNarrative = state.weatherNarrative;

        return Scaffold(
          body: Stack(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 450),
                decoration: BoxDecoration(
                  gradient: _backgroundGradient(weatherState),
                ),
              ),
              BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                child: Container(color: Colors.white.withValues(alpha: 0.06)),
              ),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'HomeJoy Climate',
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Harmony Score: $score',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(color: Colors.white.withValues(alpha: 0.9)),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        weatherNarrative,
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(color: Colors.white.withValues(alpha: 0.85)),
                      ),
                      if (state.completionFeedback != null) ...[
                        const SizedBox(height: 10),
                        _CompletionFeedbackBanner(text: state.completionFeedback!),
                      ],
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          _MetricChip(label: 'Pending Weight', value: '${state.pendingWeight}'),
                          const SizedBox(width: 8),
                          _MetricChip(label: 'Completed', value: '${state.completedCount}'),
                        ],
                      ),
                      if (state.lastSwapUpdate != null) ...[
                        const SizedBox(height: 10),
                        _SwapStatusBanner(text: state.lastSwapUpdate!),
                      ],
                      const SizedBox(height: 18),
                      Expanded(
                        child: Wrap(
                          spacing: 12,
                          runSpacing: 14,
                          children: List.generate(chores.length, (index) {
                            final chore = chores[index];
                            return Transform.translate(
                              offset: Offset(index.isEven ? 0 : 10, index.isOdd ? 4 : -2),
                              child: GestureDetector(
                                onTap: () => state.toggleChore(chore),
                                child: AnimatedOpacity(
                                  opacity: chore.isPending ? 1 : 0.45,
                                  duration: const Duration(milliseconds: 250),
                                  child: Container(
                                    width: 150,
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.22),
                                      borderRadius: BorderRadius.circular(24),
                                      border: Border.all(
                                        color: Colors.white.withValues(alpha: 0.35),
                                      ),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          chore.title,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          'Weight ${chore.weight}',
                                          style: TextStyle(
                                            color: Colors.white.withValues(alpha: 0.9),
                                            fontSize: 12,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          chore.isPending ? 'Tap to complete' : 'Done ✓ (+buffer)',
                                          style: TextStyle(
                                            color: Colors.white.withValues(alpha: 0.86),
                                            fontSize: 12,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          _memberName(state.familyMembers, chore.assignedMemberId),
                                          style: TextStyle(
                                            color: Colors.white.withValues(alpha: 0.78),
                                            fontSize: 11,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            );
                          }),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: SizedBox(
                              height: 48,
                              child: FilledButton.tonal(
                                onPressed: () => _openSwapSheet(context),
                                style: FilledButton.styleFrom(
                                  backgroundColor: Colors.white.withValues(alpha: 0.2),
                                  foregroundColor: Colors.white,
                                ),
                                child: const Text('One-Tap Swap'),
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (state.activeSwap != null) ...[
                        const SizedBox(height: 10),
                        _SwapActionCard(
                          proposal: state.activeSwap!,
                          familyMembers: state.familyMembers,
                          onAccept: (helperId) => state.acceptSwap(helperId: helperId),
                          onDecline: state.declineSwap,
                        ),
                      ],
                      const SizedBox(height: 18),
                      SizedBox(
                        height: 84,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: state.familyMembers.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 14),
                          itemBuilder: (context, index) {
                            final member = state.familyMembers[index];
                            final isGhostMode = state.memberHasOverdueTask(member.id);

                            return AnimatedOpacity(
                              opacity: isGhostMode ? 0.4 : 1,
                              duration: const Duration(milliseconds: 250),
                              child: Column(
                                children: [
                                  Container(
                                    width: 52,
                                    height: 52,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.24),
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: Colors.white.withValues(alpha: 0.38),
                                      ),
                                    ),
                                    child: Text(
                                      member.avatarEmoji,
                                      style: const TextStyle(fontSize: 24),
                                    ),
                                  ),
                                  const SizedBox(height: 5),
                                  Text(
                                    member.name,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _openSwapSheet(BuildContext context) async {
    state.expireSwapIfNeeded();
    final pending = state.chores.where((chore) => chore.isPending).toList();
    if (pending.isEmpty) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('目前沒有可換手任務，太棒了！')),
      );
      return;
    }

    final selected = await showModalBottomSheet<Chore>(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '選擇一個想換手的任務',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                for (final chore in pending)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(chore.title),
                    subtitle: Text('Weight ${chore.weight}'),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                    onTap: () => Navigator.pop(context, chore),
                  ),
              ],
            ),
          ),
        );
      },
    );

    if (selected == null) return;

    final helperCandidates = state.helperCandidatesFor(selected);
    String? targetHelperId;

    if (helperCandidates.isNotEmpty) {
      targetHelperId = await showModalBottomSheet<String>(
        context: context,
        backgroundColor: const Color(0xFF0F172A),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (context) {
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '選擇求援方式',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 12),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('廣播給全家'),
                    subtitle: const Text('任何隊友都可以接手，回應最快'),
                    onTap: () => Navigator.pop(context, ''),
                  ),
                  for (final member in helperCandidates)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text('指定 ${member.name}'),
                      subtitle: Text('${member.avatarEmoji} 精準求援'),
                      onTap: () => Navigator.pop(context, member.id),
                    ),
                ],
              ),
            ),
          );
        },
      );
    }

    state.requestSwap(
      chore: selected,
      requesterId: selected.assignedMemberId ?? state.familyMembers.first.id,
      targetHelperId: (targetHelperId?.isEmpty ?? true) ? null : targetHelperId,
      message: '我今天電力不足，誰能救救我？',
    );
  }

  LinearGradient _backgroundGradient(WeatherState weatherState) {
    switch (weatherState) {
      case WeatherState.sunny:
        return const LinearGradient(
          colors: [Color(0xFF6EE7B7), Color(0xFF3B82F6)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case WeatherState.cloudy:
        return const LinearGradient(
          colors: [Color(0xFF94A3B8), Color(0xFF64748B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case WeatherState.rainy:
        return const LinearGradient(
          colors: [Color(0xFF1E293B), Color(0xFF334155)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
    }
  }

  String _memberName(List<FamilyMember> members, String? memberId) {
    if (memberId == null) return 'Unassigned';
    for (final member in members) {
      if (member.id == memberId) {
        return 'By ${member.name}';
      }
    }
    return 'Unassigned';
  }

}

class _MetricChip extends StatelessWidget {
  const _MetricChip({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.28)),
      ),
      child: Text(
        '$label: $value',
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.92),
          fontSize: 11,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

class _SwapStatusBanner extends StatelessWidget {
  const _SwapStatusBanner({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.9),
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

class _CompletionFeedbackBanner extends StatelessWidget {
  const _CompletionFeedbackBanner({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 240),
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.22),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.38)),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.95),
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _SwapActionCard extends StatelessWidget {
  const _SwapActionCard({
    required this.proposal,
    required this.familyMembers,
    required this.onAccept,
    required this.onDecline,
  });

  final SwapProposal proposal;
  final List<FamilyMember> familyMembers;
  final ValueChanged<String> onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    FamilyMember? targetedHelper;
    if (proposal.targetHelperId != null) {
      for (final member in familyMembers) {
        if (member.id == proposal.targetHelperId) {
          targetedHelper = member;
          break;
        }
      }
    }

    final helperCandidate = targetedHelper ?? familyMembers.firstWhere(
      (member) => member.id != proposal.requesterId,
      orElse: () => familyMembers.first,
    );

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.32)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            targetedHelper == null
                ? (proposal.message ?? '我今天電力不足，誰能救救我？')
                : '向 ${helperCandidate.name} 發出求援中：${proposal.message ?? '可以幫我接手嗎？'}',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text(
            '任務：${proposal.choreTitle}',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.88), fontSize: 12),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onDecline,
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: Colors.white.withValues(alpha: 0.35)),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('稍後再說'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton(
                  onPressed: () => onAccept(helperCandidate.id),
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white.withValues(alpha: 0.28),
                    foregroundColor: Colors.white,
                  ),
                  child: Text('我來接手 (${helperCandidate.name})'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
