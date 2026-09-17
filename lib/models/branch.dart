class Branch {
  final int id;
  final String name;

  const Branch({required this.id, required this.name});

  factory Branch.fromJson(Map<String, dynamic> j) => Branch(
        id: j['id'] as int,
        name: (j['name'] as String?) ?? '',
      );
}
