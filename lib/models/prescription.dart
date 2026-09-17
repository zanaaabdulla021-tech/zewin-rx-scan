class Prescription {
  final int id;
  final String doctorName;
  final String phone;
  final List<String> medicines;
  final String category;
  final String status; // "pending" | "approved" | "rejected"
  final int imageCount;
  final String? branchName;
  final String? employeeEmail;
  final DateTime createdAt;

  const Prescription({
    required this.id,
    required this.doctorName,
    required this.phone,
    required this.medicines,
    required this.category,
    required this.status,
    required this.imageCount,
    this.branchName,
    this.employeeEmail,
    required this.createdAt,
  });

  factory Prescription.fromJson(Map<String, dynamic> j) => Prescription(
        id: j['id'] as int,
        doctorName: (j['doctorName'] as String?) ?? '',
        phone: (j['phone'] as String?) ?? '',
        medicines: ((j['medicines'] as List?) ?? [])
            .map((e) => e.toString())
            .toList(),
        category: (j['category'] as String?) ?? 'دەرمان',
        status: (j['status'] as String?) ?? 'pending',
        imageCount: (j['imageCount'] as int?) ?? 0,
        branchName: j['branchName'] as String?,
        employeeEmail: j['employeeEmail'] as String?,
        createdAt: DateTime.tryParse((j['createdAt'] as String?) ?? '') ??
            DateTime.now(),
      );
}
