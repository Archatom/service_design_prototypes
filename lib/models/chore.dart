enum ChoreStatus { pending, completed }

class Chore {
  Chore({
    required this.id,
    required this.title,
    required this.weight,
    this.status = ChoreStatus.pending,
    this.assignedMemberId,
    this.dueAt,
    this.completedAt,
  }) : assert(weight >= 1 && weight <= 5, 'Weight must be between 1 and 5.');

  final String id;
  final String title;
  final int weight;
  ChoreStatus status;
  String? assignedMemberId;
  final DateTime? dueAt;
  DateTime? completedAt;

  bool get isPending => status == ChoreStatus.pending;

  bool get isOverdue24h {
    if (dueAt == null || !isPending) return false;
    return DateTime.now().difference(dueAt!).inHours > 24;
  }

  bool get isCompletedEarly {
    if (dueAt == null || completedAt == null) return false;
    return completedAt!.isBefore(dueAt!);
  }
}
