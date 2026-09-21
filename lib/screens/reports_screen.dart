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
        child: Text('Could not load the report', style: TextStyle(color: RxColors.inkSoft)),
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
          _sectionTitle('Total'),
          _row('Total orders', '${data['total']}'),
          const SizedBox(height: 22),
          _sectionTitle('By branch'),
          ...byBranch.map((r) => _row(r['name'] as String, '${r['count']}')),
          const SizedBox(height: 22),
          _sectionTitle('By employee'),
          ...byEmployee.map((r) => _row(r['name'] as String, '${r['count']}')),
          const SizedBox(height: 22),
          _sectionTitle('By category'),
          _barChartHorizontal(byCategory),
          ...byCategory.map((r) => _row(r['name'] as String, '${r['count']}')),
          const SizedBox(height: 22),
          _sectionTitle('By source (government/private)'),
          ...(data['bySource'] as List? ?? []).map((r) => _row(r['name'] as String, '${r['count']}')),
          const SizedBox(height: 22),
          _sectionTitle('By year'),
          ...(data['byYear'] as List? ?? []).map((r) => _row(r['name'] as String, '${r['count']}')),
          const SizedBox(height: 22),
          _sectionTitle('By month'),
          _barChartVertical(((data['byMonth'] as List? ?? []).take(12).toList().reversed.toList())),
          ...(data['byMonth'] as List? ?? []).map((r) => _row(r['name'] as String, '${r['count']}')),
          const SizedBox(height: 22),
          _sectionTitle('By day (last 30 days)'),
          ...((data['byDay'] as List? ?? []).take(30)).map((r) => _row(r['name'] as String, '${r['count']}')),
          const SizedBox(height: 22),
          _sectionTitle('By doctor (tap for details)'),
          TextField(
            controller: _doctorSearchCtrl,
            onChanged: (v) => setState(() => _doctorSearchTerm = v),
            decoration: const InputDecoration(hintText: 'Search by doctor name...'),
          ),
          const SizedBox(height: 8),
          ...byDoctor.map((r) => _row(
                r['name'] as String,
                '${r['count']}',
                onTap: () => _openDoctor(r['name'] as String),
              )),
          const SizedBox(height: 22),
          _sectionTitle('Most used items'),
          ...topMedicines.map((r) => _row(r['name'] as String, '${r['count']}')),
          if (_selectedDoctor != null) ...[
            const SizedBox(height: 26),
            _sectionTitle('Details: $_selectedDoctor'),
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
      return [const Text('Could not be loaded', style: TextStyle(color: RxColors.inkSoft, fontSize: 13))];
    }
    final rows = (detail['prescriptions'] as List? ?? []);
    if (rows.isEmpty) {
      return [const Text('No orders', style: TextStyle(color: RxColors.inkSoft, fontSize: 13))];
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
              '${p['branchName'] ?? "—"} · ${p['employeeEmail'] ?? "—"} · ${p['category'] ?? "Medicine"} · ${p['source'] ?? "Private"} · $dateStr',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 3),
            Text(
              meds.isNotEmpty ? meds.join(', ') : 'No items recorded',
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

  Widget _barChartHorizontal(List<dynamic> data) {
    if (data.isEmpty) return const SizedBox.shrink();
    final maxCount = data
        .map((d) => d['count'] as int)
        .fold<int>(1, (a, b) => b > a ? b : a);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        children: data.map((d) {
          final count = d['count'] as int;
          final name = d['name'] as String;
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              children: [
                SizedBox(
                  width: 90,
                  child: Text(name, style: const TextStyle(fontSize: 11.5, color: RxColors.inkSoft), overflow: TextOverflow.ellipsis),
                ),
                Expanded(
                  child: FractionallySizedBox(
                    alignment: Alignment.centerLeft,
                    widthFactor: (count / maxCount).clamp(0.02, 1.0),
                    child: Container(
                      height: 16,
                      decoration: BoxDecoration(color: RxColors.amber, borderRadius: BorderRadius.circular(4)),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                Text('$count', style: const TextStyle(fontSize: 11.5)),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _barChartVertical(List<dynamic> data) {
    if (data.isEmpty) return const SizedBox.shrink();
    final maxCount = data
        .map((d) => d['count'] as int)
        .fold<int>(1, (a, b) => b > a ? b : a);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SizedBox(
        height: 150,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: data.map((d) {
            final count = d['count'] as int;
            final name = d['name'] as String;
            final label = name.length >= 7 ? name.substring(5) : name;
            return Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text('$count', style: const TextStyle(fontSize: 9)),
                  const SizedBox(height: 2),
                  Expanded(
                    child: Align(
                      alignment: Alignment.bottomCenter,
                      child: FractionallySizedBox(
                        heightFactor: (count / maxCount).clamp(0.02, 1.0),
                        child: Container(
                          margin: const EdgeInsets.symmetric(horizontal: 2),
                          decoration: BoxDecoration(color: RxColors.amber, borderRadius: BorderRadius.circular(3)),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(label, style: const TextStyle(fontSize: 9, color: RxColors.inkSoft)),
                ],
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

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
