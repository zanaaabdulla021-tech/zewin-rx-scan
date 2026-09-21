import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../theme.dart';

class FormScreen extends StatefulWidget {
  final String initialDoctor;
  final String initialPhone;
  final List<String> initialMedicines;
  final List<File> imageFiles;

  const FormScreen({
    super.key,
    required this.initialDoctor,
    required this.initialPhone,
    required this.initialMedicines,
    this.imageFiles = const [],
  });

  @override
  State<FormScreen> createState() => _FormScreenState();
}

class _FormScreenState extends State<FormScreen> {
  late final TextEditingController _doctorCtrl;
  late final TextEditingController _phoneCtrl;
  late List<TextEditingController> _medCtrls;
  final Map<int, String?> _itemPreviews = {};
  final Map<int, Timer> _debouncers = {};
  String _category = 'Medicine';
  String _source = 'Private';
  bool _saving = false;

  static const categories = ['Medicine', 'Dairy', 'Beauty', 'Equipment'];
  static const sources = ['Private', 'Government'];

  @override
  void initState() {
    super.initState();
    _doctorCtrl = TextEditingController(text: widget.initialDoctor);
    _phoneCtrl = TextEditingController(text: widget.initialPhone);
    final meds = widget.initialMedicines.isEmpty ? [''] : widget.initialMedicines;
    _medCtrls = meds.map((m) => TextEditingController(text: m)).toList();
    for (var i = 0; i < _medCtrls.length; i++) {
      if (_medCtrls[i].text.trim().isNotEmpty) _lookupItemImage(i);
    }
  }

  @override
  void dispose() {
    _doctorCtrl.dispose();
    _phoneCtrl.dispose();
    for (final c in _medCtrls) {
      c.dispose();
    }
    for (final t in _debouncers.values) {
      t.cancel();
    }
    super.dispose();
  }

  void _addMedRow() {
    setState(() => _medCtrls.add(TextEditingController()));
  }

  void _removeMedRow(int index) {
    setState(() {
      _medCtrls[index].dispose();
      _medCtrls.removeAt(index);
      _itemPreviews.remove(index);
    });
  }

  void _onMedChanged(int index, String value) {
    _itemPreviews[index] = null;
    _debouncers[index]?.cancel();
    _debouncers[index] = Timer(const Duration(milliseconds: 500), () => _lookupItemImage(index));
  }

  Future<void> _lookupItemImage(int index) async {
    if (index >= _medCtrls.length) return;
    final name = _medCtrls[index].text.trim();
    if (name.isEmpty) return;
    try {
      final img = await ApiService().getItemImage(name);
      if (mounted) setState(() => _itemPreviews[index] = img);
    } catch (_) {}
  }

  Future<void> _save() async {
    final doctorName = _doctorCtrl.text.trim();
    final phone = _phoneCtrl.text.trim();
    final medicines = _medCtrls
        .map((c) => c.text.trim())
        .where((s) => s.isNotEmpty)
        .toList();

    if (doctorName.isEmpty && phone.isEmpty && medicines.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill in at least one field before saving')),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      List<Map<String, String>>? images;
      if (widget.imageFiles.isNotEmpty) {
        images = await Future.wait(widget.imageFiles.map((file) async {
          final bytes = await file.readAsBytes();
          final path = file.path.toLowerCase();
          final mediaType = path.endsWith('.png')
              ? 'image/png'
              : path.endsWith('.webp')
                  ? 'image/webp'
                  : 'image/jpeg';
          return {'imageBase64': base64Encode(bytes), 'mediaType': mediaType};
        }));
      }
      await ApiService().savePrescription(
        doctorName: doctorName,
        phone: phone,
        medicines: medicines,
        category: _category,
        source: _source,
        images: images,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Saved')),
      );
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      String msg = 'Could not be saved. Please try again.';
      if (e is ApiException && e.errorCode == 'plan_limit_reached') {
        final max = e.body?['max'];
        msg = 'Your pharmacy has reached its monthly scan limit ($max). Ask the platform admin to upgrade your plan.';
      }
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Review & Save')),
      backgroundColor: RxColors.paper,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 30),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: RxColors.paper2,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: RxColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Category', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      initialValue: _category,
                      items: categories
                          .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                          .toList(),
                      onChanged: (v) => setState(() => _category = v ?? 'Medicine'),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Source', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      initialValue: _source,
                      items: sources
                          .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                          .toList(),
                      onChanged: (v) => setState(() => _source = v ?? 'Private'),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                _field("Doctor's name", _doctorCtrl, hint: 'e.g. Dr. Aras Mohammed'),
                const SizedBox(height: 14),
                _field('Phone number', _phoneCtrl,
                    hint: '0750 000 0000', keyboardType: TextInputType.phone),
                const SizedBox(height: 14),
                const Text('Items',
                    style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
                const SizedBox(height: 8),
                ..._medCtrls.asMap().entries.map((entry) {
                  final i = entry.key;
                  final ctrl = entry.value;
                  final preview = _itemPreviews[i];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: ctrl,
                                onChanged: (v) => _onMedChanged(i, v),
                                decoration: const InputDecoration(hintText: 'Item name'),
                              ),
                            ),
                            const SizedBox(width: 8),
                            InkWell(
                              onTap: () => _removeMedRow(i),
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: RxColors.paper,
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: RxColors.line),
                                ),
                                child: const Icon(Icons.close, size: 16, color: RxColors.dangerDeep),
                              ),
                            ),
                          ],
                        ),
                        if (preview != null && preview.contains(','))
                          Padding(
                            padding: const EdgeInsets.only(top: 5),
                            child: Row(
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(6),
                                  child: Image.memory(
                                    base64Decode(preview.split(',').last),
                                    width: 34, height: 34, fit: BoxFit.cover,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                const Text('Previous photo for this item',
                                    style: TextStyle(fontSize: 11.5, color: RxColors.inkSoft)),
                              ],
                            ),
                          ),
                      ],
                    ),
                  );
                }),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: _addMedRow,
                    icon: const Icon(Icons.add, size: 16, color: RxColors.amberDeep),
                    label: const Text('+ Add item',
                        style: TextStyle(color: RxColors.amberDeep, fontSize: 13.5)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox(
                      width: 16, height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: RxColors.amberTint))
                  : const Icon(Icons.check, size: 18),
              label: const Text('Save order'),
              style: ElevatedButton.styleFrom(
                backgroundColor: RxColors.stamp,
                foregroundColor: RxColors.amberTint,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _field(String label, TextEditingController ctrl,
      {String? hint, TextInputType? keyboardType}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          keyboardType: keyboardType,
          decoration: InputDecoration(hintText: hint),
        ),
      ],
    );
  }
}
