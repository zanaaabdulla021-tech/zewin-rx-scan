/// One company a person can act as — a person may belong to more than
/// one, and switches between them via AuthService.switchCompany.
class CompanyMembership {
  final int organizationId;
  final String organizationName;
  final String role;

  const CompanyMembership({
    required this.organizationId,
    required this.organizationName,
    required this.role,
  });

  factory CompanyMembership.fromJson(Map<String, dynamic> j) => CompanyMembership(
        organizationId: j['organizationId'] as int,
        organizationName: (j['organizationName'] as String?) ?? '',
        role: (j['role'] as String?) ?? 'employee',
      );
}

class AppUser {
  final int id;
  final String email;
  final String role; // "owner" | "company_admin" | "branch_manager" | "employee" | "viewer" | "super_admin"
  final int? branchId;
  final String? branchName;
  final String? organizationName;
  final String? avatarData;
  final List<CompanyMembership> companies;

  const AppUser({
    required this.id,
    required this.email,
    required this.role,
    this.branchId,
    this.branchName,
    this.organizationName,
    this.avatarData,
    this.companies = const [],
  });

  bool get isOwner => role == 'owner';
  bool get isCompanyAdmin => role == 'company_admin';
  bool get isBranchManager => role == 'branch_manager';
  bool get isViewer => role == 'viewer';
  bool get isSuperAdmin => role == 'super_admin';
  // Manages branches, users, and company-wide settings.
  bool get isOrgManager => role == 'owner' || role == 'company_admin';
  // Can see company-wide data (branches, users, every branch's
  // prescriptions, reports) — including read-only viewers.
  bool get isOrgReader => isOrgManager || role == 'viewer';
  // Can approve/reject prescriptions.
  bool get canReview => isOrgManager || role == 'branch_manager';
  // Can scan and save a new prescription — everyone except a viewer.
  bool get canScan => role != 'viewer';
  // Belongs to more than one company, so a switcher should be shown.
  bool get hasMultipleCompanies => companies.length > 1;

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: j['id'] as int,
        email: j['email'] as String,
        role: (j['role'] as String?) ?? 'employee',
        branchId: j['branchId'] as int?,
        branchName: j['branchName'] as String?,
        organizationName: j['organizationName'] as String?,
        avatarData: j['avatarData'] as String?,
        companies: ((j['companies'] as List?) ?? [])
            .map((e) => CompanyMembership.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
