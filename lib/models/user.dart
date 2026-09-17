class AppUser {
  final int id;
  final String email;
  final String role; // "admin" | "employee"
  final int? branchId;
  final String? branchName;
  final String? avatarData;

  const AppUser({
    required this.id,
    required this.email,
    required this.role,
    this.branchId,
    this.branchName,
    this.avatarData,
  });

  bool get isAdmin => role == 'admin';
  bool get isManager => role == 'manager';
  bool get canReview => role == 'admin' || role == 'manager';

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: j['id'] as int,
        email: j['email'] as String,
        role: (j['role'] as String?) ?? 'employee',
        branchId: j['branchId'] as int?,
        branchName: j['branchName'] as String?,
        avatarData: j['avatarData'] as String?,
      );
}
