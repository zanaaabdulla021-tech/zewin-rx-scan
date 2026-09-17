import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../theme.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  final _api = ApiService();
  Map<String, dynamic>? _overview;
  bool _loading = true;

  String? _selectedDoctor;
  Map<String, dynamic>? _doctorDetail;
  bool _loadingDoctor = false;

  final _doctorSearchCtrl = TextEditingController();
  String _doctorSearchTerm = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _doctorSearchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await _api.getReportsOverview();
      if (mounted) setState(() => _overview = data);
    } catch (_) {
      // keep whatever was last loaded
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _openDoctor(String name) async {
    setState(() {
      _selectedDoctor = name;
      _loadingDoctor = true;
      _doctorDetail = null;
    });
    try {
      final data = await _api.getDoctorReport(name);
      if (mounted) setState(() => _doctorDetail = data);
    } catch (_) {}
    if (mounted) setState(() => _loadingDoctor = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: RxColors.amberDeep));
    }
    final data = _overview;
    if (data == null) {
      return const Center(
        child: Text('نەتوانرا ڕاپۆرت باربکرێت', style: TextStyle(color: RxColors.inkSoft)),
      );
    }

    final byBranch = (data['byBranch'] as List? ?? []);
    final byEmployee = (data['byEmployee'] as List? ?? []);
    final byCategory = (data['byCategory'] as List? ?? []);
    final byDoctorAll = (data['byDoctor'] as List? ?? []);
    final byDoctor = _doctorSearchTerm.isEmpty
        ? byDoctorAll
        : byDoctorAll.where((r) => (r['name'] as String).toLowerCase().contains(_doctorSearchTerm.toLowerCase())).toList();
    final topMedicines = (data['topMedicines'] as List? ?? []);

    return RefreshIndicator(
      onRefresh: _load,
      color: RxColors.amberDeep,
      child: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          _sectionTitle('کۆی گشتی'),
          _row('کۆی گشتی ڕەسیتەکان', '${data['total']}'),
          const SizedBox(height: 22),
          _sectionTitle('بەپێی لق'),
          ...byBranch.map((r) => _row(r['name'] as String, '${r['count']}')),
          const SizedBox(height: 22),
          _sectionTitle('بەپێی کارمەند'),
          ...byEmployee.map((r) => _row(r['name'] as String, '${r['count']}')),
          const SizedBox(height: 22),
          _sectionTitle('بەپێی جۆر'),
          ...byCategory.map((r) => _row(r['name'] as String, '${r['count']}')),
          const SizedBox(height: 22),
          _sectionTitle('بەپێی دکتۆر (کرتە بکە بۆ وردەکاری)'),
          TextField(
            controller: _doctorSearchCtrl,
            onChanged: (v) => setState(() => _doctorSearchTerm = v),
            decoration: const InputDecoration(hintText: 'گەڕان بۆ ناوی دکتۆر...'),
          ),
          const SizedBox(height: 8),
          ...byDoctor.map((r) => _row(
                r['name'] as String,
                '${r['count']}',
                onTap: () => _openDoctor(r['name'] as String),
              )),
          const SizedBox(height: 22),
          _sectionTitle('دەرمانە زۆر بەکارهاتووەکان'),
          ...topMedicines.map((r) => _row(r['name'] as String, '${r['count']}')),
          if (_selectedDoctor != null) ...[
            const SizedBox(height: 26),
            _sectionTitle('وردەکاری: $_selectedDoctor'),
            if (_loadingDoctor)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 14),
                child: Center(child: CircularProgressIndicator(color: RxColors.amberDeep)),
              )
            else
              ..._buildDoctorDetail(),
          ],
        ],
      ),
    );
  }

  List<Widget> _buildDoctorDetail() {
    final detail = _doctorDetail;
    if (detail == null) {
      return [const Text('نەتوانرا باربکرێت', style: TextStyle(color: RxColors.inkSoft, fontSize: 13))];
    }
    final rows = (detail['prescriptions'] as List? ?? []);
    if (rows.isEmpty) {
      return [const Text('هیچ ڕەسیتێک نییە', style: TextStyle(color: RxColors.inkSoft, fontSize: 13))];
    }
    return rows.map<Widget>((p) {
      final meds = (p['medicines'] as List? ?? []).cast<String>();
      final date = DateTime.tryParse(p['createdAt'] as String? ?? '');
      final dateStr = date != null ? '${date.year}/${date.month}/${date.day}' : '';
      return Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: RxColors.paper2,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: RxColors.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${p['branchName'] ?? "—"} · ${p['employeeEmail'] ?? "—"} · ${p['category'] ?? "دەرمان"} · $dateStr',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 3),
            Text(
              meds.isNotEmpty ? meds.join('، ') : 'دەرمانێک تۆمار نەکراوە',
              style: const TextStyle(fontSize: 12.5, color: RxColors.inkSoft),
            ),
          ],
        ),
      );
    }).toList();
  }

  Widget _sectionTitle(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
      );

  Widget _row(String name, String count, {VoidCallback? onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: RxColors.paper2,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: RxColors.line),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(child: Text(name, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600))),
            Text(count, style: const TextStyle(fontSize: 13, color: RxColors.inkSoft)),
          ],
        ),
      ),
    );
  }
}
