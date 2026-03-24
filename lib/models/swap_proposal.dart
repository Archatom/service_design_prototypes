enum SwapProposalStatus { pending, accepted, declined, expired }

class SwapProposal {
  SwapProposal({
    required this.choreId,
    required this.choreTitle,
    required this.requesterId,
    required this.createdAt,
    required this.expiresAt,
    this.message,
    this.helperId,
    this.targetHelperId,
    this.status = SwapProposalStatus.pending,
  });

  final String choreId;
  final String choreTitle;
  final String requesterId;
  final DateTime createdAt;
  final DateTime expiresAt;
  final String? message;
  final String? targetHelperId;
  String? helperId;
  SwapProposalStatus status;

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}
