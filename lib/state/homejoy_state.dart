import 'dart:async';

import 'package:flutter/foundation.dart';

import '../logic/family_weather_logic.dart';
import '../models/chore.dart';
import '../models/family_member.dart';
import '../models/swap_proposal.dart';
import '../models/weather_state.dart';

class HomeJoyState extends ChangeNotifier {
  HomeJoyState({
    required List<Chore> chores,
    required List<FamilyMember> familyMembers,
  })  : _chores = chores,
        _familyMembers = familyMembers;

  final FamilyWeatherLogic _weatherLogic = const FamilyWeatherLogic();

  final List<Chore> _chores;
  final List<FamilyMember> _familyMembers;
  SwapProposal? _activeSwap;
  String? _lastSwapUpdate;
  String? _completionFeedback;
  Timer? _completionFeedbackTimer;
  int _lastScoreSnapshot = 100;

  List<Chore> get chores => List.unmodifiable(_chores);
  List<FamilyMember> get familyMembers => List.unmodifiable(_familyMembers);
  SwapProposal? get activeSwap => _activeSwap;
  String? get lastSwapUpdate => _lastSwapUpdate;
  String? get completionFeedback => _completionFeedback;

  int get harmonyScore => _weatherLogic.calculateScore(_chores);
  WeatherState get weatherState => _weatherLogic.toWeatherState(_chores);
  int get pendingWeight => _weatherLogic.pendingWeight(_chores);
  int get completedCount => _weatherLogic.completedCount(_chores);
  String get weatherNarrative => _weatherLogic.weatherNarrative(
        chores: _chores,
        previousScore: _lastScoreSnapshot,
      );

  void toggleChore(Chore chore) {
    final target = _chores.firstWhere((item) => identical(item, chore));
    final previousScore = harmonyScore;
    _lastScoreSnapshot = previousScore;

    final nextStatus = target.status == ChoreStatus.pending
        ? ChoreStatus.completed
        : ChoreStatus.pending;

    target.status = nextStatus;
    target.completedAt = nextStatus == ChoreStatus.completed ? DateTime.now() : null;

    if (nextStatus == ChoreStatus.completed) {
      _setCompletionFeedback(
        _buildCompletionFeedback(
          chore: target,
          previousScore: previousScore,
          nextScore: harmonyScore,
        ),
      );
    }

    notifyListeners();
  }

  bool memberHasOverdueTask(String memberId) {
    return _chores.any(
      (chore) => chore.assignedMemberId == memberId && chore.isOverdue24h,
    );
  }

  List<Chore> choresForMember(String memberId) {
    return _chores.where((chore) => chore.assignedMemberId == memberId).toList();
  }

  void requestSwap({
    required Chore chore,
    required String requesterId,
    String? targetHelperId,
    String? message,
  }) {
    _lastScoreSnapshot = harmonyScore;
    _activeSwap = SwapProposal(
      choreId: chore.id,
      choreTitle: chore.title,
      requesterId: requesterId,
      createdAt: DateTime.now(),
      expiresAt: DateTime.now().add(const Duration(minutes: 20)),
      targetHelperId: targetHelperId,
      message: message,
    );

    if (targetHelperId == null) {
      _lastSwapUpdate = '求援已送出（全家可接手）：${chore.title}';
    } else {
      String? helperName;
      for (final member in _familyMembers) {
        if (member.id == targetHelperId) {
          helperName = member.name;
          break;
        }
      }
      _lastSwapUpdate = '已向 ${helperName ?? '隊友'} 送出求援：${chore.title}';
    }

    notifyListeners();
  }

  void acceptSwap({
    required String helperId,
  }) {
    final proposal = _activeSwap;
    if (proposal == null) return;
    if (proposal.isExpired) {
      proposal.status = SwapProposalStatus.expired;
      _activeSwap = null;
      _lastSwapUpdate = '求援逾時，請重新送出。';
      notifyListeners();
      return;
    }

    _lastScoreSnapshot = harmonyScore;

    Chore? chore;
    for (final item in _chores) {
      if (item.id == proposal.choreId) {
        chore = item;
        break;
      }
    }

    if (chore != null) {
      chore.assignedMemberId = helperId;
    }

    proposal.helperId = helperId;
    proposal.status = SwapProposalStatus.accepted;
    String? helperName;
    for (final member in _familyMembers) {
      if (member.id == helperId) {
        helperName = member.name;
        break;
      }
    }
    _lastSwapUpdate = '換手成功：${proposal.choreTitle} → ${helperName ?? '隊友'}';
    _activeSwap = null;
    notifyListeners();
  }

  void declineSwap() {
    final proposal = _activeSwap;
    if (proposal == null) return;

    _lastScoreSnapshot = harmonyScore;

    proposal.status = SwapProposalStatus.declined;
    _lastSwapUpdate = '暫時沒人接手：${proposal.choreTitle}';
    _activeSwap = null;
    notifyListeners();
  }

  void expireSwapIfNeeded() {
    final proposal = _activeSwap;
    if (proposal == null) return;
    if (!proposal.isExpired) return;

    proposal.status = SwapProposalStatus.expired;
    _activeSwap = null;
    _lastSwapUpdate = '求援已逾時：${proposal.choreTitle}';
    notifyListeners();
  }

  List<FamilyMember> helperCandidatesFor(Chore chore) {
    return _familyMembers
        .where((member) => member.id != (chore.assignedMemberId ?? ''))
        .toList();
  }

  String _buildCompletionFeedback({
    required Chore chore,
    required int previousScore,
    required int nextScore,
  }) {
    FamilyMember? member;
    for (final item in _familyMembers) {
      if (item.id == chore.assignedMemberId) {
        member = item;
        break;
      }
    }
    final avatar = member?.avatarEmoji ?? '🌟';
    final actorName = member?.name ?? '隊友';
    final delta = nextScore - previousScore;
    if (delta >= 5) {
      return '$avatar $actorName 完成「${chore.title}」，家中天氣明顯放晴 (+$delta)';
    }
    if (delta >= 1) {
      return '$avatar $actorName 完成「${chore.title}」，氣氛更輕鬆了 (+$delta)';
    }
    return '$avatar $actorName 完成「${chore.title}」，穩住節奏真棒！';
  }

  void _setCompletionFeedback(String message) {
    _completionFeedbackTimer?.cancel();
    _completionFeedback = message;
    _completionFeedbackTimer = Timer(const Duration(seconds: 4), () {
      _completionFeedback = null;
      notifyListeners();
    });
  }

  @override
  void dispose() {
    _completionFeedbackTimer?.cancel();
    super.dispose();
  }
}
