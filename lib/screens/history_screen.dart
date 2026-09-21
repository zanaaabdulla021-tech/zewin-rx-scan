import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/prescription.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../theme.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => HistoryScreenState();
}

class HistoryScreenState extends State<HistoryScreen> {
  List<Prescription> _items = [];
  bool _loading = true;
  final Set<int> _openIds = {};
  final Set<int> _openImageIds = {};
  final Map<int, List<String>?> _loadedImages = {};
  final _searchCtrl = TextEditingController();
  String _searchTerm = '';
  String? _branchFilter;

  bool get _canReview => AuthService.instance.currentUser?.canReview ?? false;
  bool get _isOrgReader => AuthService.instance.currentUser?.isOrgReader ?? false;

  List<String> get _branchNames {
    final names = _items.map((p) => p.branchName).whereType<String>().toSet().toList();
    names.sort();
    return names;
  }

  List<Prescription> get _filtered {
    var items = _items;
    if (_branchFilter != null && _branchFilter!.isNotEmpty) {
      items = items.where((p) => p.branchName == _branchFilter).toList();
    }
    if (_searchTerm.isEmpty) return items;
    final term = _searchTerm.toLowerCase();
    return items.where((p) {
      final haystack = [
        p.doctorName, p.phone, p.category, p.source, p.branchName ?? '', p.employeeEmail ?? '',
        ...p.medicines,
      ].join(' ').toLowerCase();
      return haystack.contains(term);
    }).toList();
  }

  @override
  void initState() {
    super.initState();
    refresh();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> refresh() async {
    setState(() => _loading = true);
    try {
      final items = await ApiService().getPrescriptions();
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _delete(Prescription p) async {
    await ApiService().deletePrescription(p.id);
    refresh();
  }

  Future<void> _approve(Prescription p) async {
    await ApiService().approvePrescription(p.id);
    refresh();
  }

  Future<void> _reject(Prescription p) async {
    await ApiService().rejectPrescription(p.id);
    refresh();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: RxColors.amberDeep));
    }

    final filtered = _filtered;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
          child: TextField(
            controller: _searchCtrl,
            onChanged: (v) => setState(() => _searchTerm = v),
            decoration: const InputDecoration(
              hintText: 'Search by doctor, item, branch, employee...',
              prefixIcon: Icon(Icons.search, size: 20),
            ),
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? Padding(
                  padding: const EdgeInsets.all(18),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 12),
                    decoration: BoxDecoration(
                      border: Border.all(color: RxColors.line, style: BorderStyle.solid),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      _items.isEmpty ? 'No orders saved yet' : 'No results found',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 13.5, color: RxColors.inkSoft),
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: refresh,
                  color: RxColors.amberDeep,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(18),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, i) => _buildItem(filtered[i]),
                  ),
                ),
        ),
      ],
    );
  }

  Widget _buildImageSection(Prescription p) {
    final open = _openImageIds.contains(p.id);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextButton.icon(
          onPressed: () async {
            setState(() {
              if (open) {
                _openImageIds.remove(p.id);
              } else {
                _openImageIds.add(p.id);
              }
            });
            if (!open && !_loadedImages.containsKey(p.id)) {
              try {
                final imgs = await ApiService().getPrescriptionImages(p.id);
                if (mounted) setState(() => _loadedImages[p.id] = imgs);
              } catch (_) {
                if (mounted) setState(() => _loadedImages[p.id] = null);
              }
            }
          },
          icon: const Icon(Icons.image_outlined, size: 16, color: RxColors.amberDeep),
          label: Text(open ? 'Hide photo' : 'View photo (${p.imageCount})',
              style: const TextStyle(color: RxColors.amberDeep, fontSize: 12.5)),
        ),
        if (open) _buildImageContent(p.id),
      ],
    );
  }

  Widget _buildImageContent(int id) {
    if (!_loadedImages.containsKey(id)) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 10),
        child: Center(child: CircularProgressIndicator(color: RxColors.amberDeep, strokeWidth: 2)),
      );
    }
    final dataUris = _loadedImages[id];
    if (dataUris == null || dataUris.isEmpty) {
      return const Text('Could not load the photo', style: TextStyle(fontSize: 12.5, color: RxColors.inkSoft));
    }
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 6,
        mainAxisSpacing: 6,
      ),
      itemCount: dataUris.length,
      itemBuilder: (context, i) {
        final uri = dataUris[i];
        if (!uri.contains(',')) return const SizedBox.shrink();
        final bytes = base64Decode(uri.split(',').last);
        return ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.memory(bytes, fit: BoxFit.cover),
        );
      },
    );
  }

  Widget _statusBadge(String status) {
    Color bg, fg;
    String label;
    switch (status) {
      case 'approved':
        bg = const Color(0x265A7A44);
        fg = const Color(0xFF3E5A2C);
        label = 'Approved';
        break;
      case 'rejected':
        bg = RxColors.danger.withValues(alpha: 0.12);
        fg = RxColors.dangerDeep;
        label = 'Rejected';
        break;
      default:
        bg = RxColors.pending.withValues(alpha: 0.15);
        fg = RxColors.pendingDeep;
        label = 'Pending';
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg)),
    );
  }

  Widget _buildItem(Prescription p) {
    final open = _openIds.contains(p.id);
    final dateStr = DateFormat('d MMM y').format(p.createdAt);
    return Container(
      decoration: BoxDecoration(
        color: RxColors.paper2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: RxColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => setState(() {
              open ? _openIds.remove(p.id) : _openIds.add(p.id);
            }),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${p.doctorName.isEmpty ? "No doctor name" : p.doctorName} · ${p.category} · ${p.source}',
                          style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: RxColors.ink),
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          [
                            '$dateStr · ${p.medicines.length} Medicine',
                            if (p.branchName != null) p.branchName!,
                            if (p.employeeEmail != null) p.employeeEmail!,
                          ].join(' · '),
                          style: const TextStyle(fontSize: 12, color: RxColors.inkSoft),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  _statusBadge(p.status),
                  const SizedBox(width: 8),
                  Icon(open ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                      color: RxColors.inkSoft, size: 20),
                ],
              ),
            ),
          ),
          if (open)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Divider(color: RxColors.line, height: 1),
                  const SizedBox(height: 10),
                  if (p.medicines.isEmpty)
                    const Text('No items recorded',
                        style: TextStyle(fontSize: 13, color: RxColors.inkSoft))
                  else
                    ...p.medicines.map((m) => Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text('•  $m', style: const TextStyle(fontSize: 13.5, height: 1.6)),
                        )),
                  if (p.phone.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text('Number: ${p.phone}', style: const TextStyle(fontSize: 13, color: RxColors.inkSoft)),
                  ],
                  if (p.imageCount > 0) ...[
                    const SizedBox(height: 8),
                    _buildImageSection(p),
                  ],
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      if (_canReview && p.status == 'pending')
                        Row(
                          children: [
                            TextButton.icon(
                              onPressed: () => _approve(p),
                              icon: const Icon(Icons.check, size: 15, color: Color(0xFF3E5A2C)),
                              label: const Text('Approve', style: TextStyle(color: Color(0xFF3E5A2C), fontSize: 12.5)),
                            ),
                            TextButton.icon(
                              onPressed: () => _reject(p),
                              icon: const Icon(Icons.close, size: 15, color: RxColors.danger),
                              label: const Text('Reject', style: TextStyle(color: RxColors.danger, fontSize: 12.5)),
                            ),
                          ],
                        )
                      else
                        const SizedBox.shrink(),
                      TextButton.icon(
                        onPressed: () => _delete(p),
                        icon: const Icon(Icons.delete_outline, size: 15, color: RxColors.danger),
                        label: const Text('Delete', style: TextStyle(color: RxColors.danger, fontSize: 12.5)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
