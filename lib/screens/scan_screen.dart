import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../services/cloud_ocr_service.dart';
import '../services/ocr_service.dart';
import '../theme.dart';
import '../widgets/slip_card.dart';
import 'form_screen.dart';

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final _picker = ImagePicker();
  final _localOcr = OcrService();
  final _cloudOcr = CloudOcrService();

  final List<File> _images = [];
  bool _reading = false;
  String? _notice;

  @override
  void dispose() {
    _localOcr.dispose();
    super.dispose();
  }

  Future<void> _pick(ImageSource source) async {
    if (source == ImageSource.gallery) {
      final xfiles = await _picker.pickMultiImage(imageQuality: 90);
      if (xfiles.isEmpty) return;
      setState(() {
        _images.addAll(xfiles.map((x) => File(x.path)));
        _notice = null;
      });
    } else {
      final xfile = await _picker.pickImage(source: source, imageQuality: 90);
      if (xfile == null) return;
      setState(() {
        _images.add(File(xfile.path));
        _notice = null;
      });
    }
  }

  Future<void> _goToForm(String doctor, String phone, List<String> medicines) async {
    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => FormScreen(
          initialDoctor: doctor,
          initialPhone: phone,
          initialMedicines: medicines,
          imageFiles: List<File>.from(_images),
        ),
      ),
    );
    if (mounted) setState(() => _images.clear());
  }

  Future<void> _read() async {
    if (_images.isEmpty) return;
    setState(() {
      _reading = true;
      _notice = null;
    });

    final primary = _images.first;
    try {
      // Prefer the cloud backend — it reads Kurdish/Arabic handwriting.
      try {
        final cloud = await _cloudOcr.readImage(primary);
        await _goToForm(cloud.doctorName, cloud.phone, cloud.medicines);
        return;
      } on CloudOcrException catch (ce) {
        if (ce.reason != 'backend_not_configured') {
          setState(() {
            _notice = 'Could not reach the AI server — trying on-device reading (Latin script only).';
          });
        }
      }

      // Fallback: on-device, Latin-script only.
      final local = await _localOcr.readImage(primary.path);
      await _goToForm('', local.phone ?? '', local.lines);
    } catch (e) {
      setState(() {
        _notice = 'Something went wrong while reading. Please try again or enter it manually.';
      });
    } finally {
      if (mounted) setState(() => _reading = false);
    }
  }

  void _manualEntry() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => FormScreen(
          initialDoctor: '',
          initialPhone: '',
          initialMedicines: const [],
          imageFiles: List<File>.from(_images),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Prescription photo (you can add more than one)',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: RxColors.inkSoft,
            ),
          ),
          const SizedBox(height: 12),
          if (_images.isEmpty) _buildDropzone() else _buildPreview(),
          if (_notice != null) ...[
            const SizedBox(height: 14),
            _buildNotice(_notice!),
          ],
          const SizedBox(height: 18),
          TextButton(
            onPressed: _manualEntry,
            child: const Text(
              'Or enter the details manually',
              style: TextStyle(color: RxColors.inkSoft, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDropzone() {
    return SlipCard(
      child: Column(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: RxColors.paper,
              shape: BoxShape.circle,
              border: Border.all(color: RxColors.line),
            ),
            child: const Icon(Icons.camera_alt_outlined,
                color: RxColors.amberDeep, size: 24),
          ),
          const SizedBox(height: 14),
          const Text(
            'Take or choose a photo to get started',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13.5, color: RxColors.inkSoft, height: 1.5),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ElevatedButton(
                onPressed: () => _pick(ImageSource.camera),
                child: const Text('Take photo'),
              ),
              const SizedBox(width: 10),
              OutlinedButton(
                onPressed: () => _pick(ImageSource.gallery),
                style: OutlinedButton.styleFrom(
                  foregroundColor: RxColors.inkSoft,
                  side: const BorderSide(color: RxColors.line),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(999)),
                ),
                child: const Text('Choose file'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPreview() {
    return Column(
      children: [
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
          ),
          itemCount: _images.length,
          itemBuilder: (context, i) => Stack(
            children: [
              Positioned.fill(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.file(_images[i], fit: BoxFit.cover),
                ),
              ),
              Positioned(
                top: 3,
                right: 3,
                child: GestureDetector(
                  onTap: () => setState(() => _images.removeAt(i)),
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      color: RxColors.bg.withValues(alpha: 0.75),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.close, size: 13, color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            OutlinedButton(
              onPressed: () => _pick(ImageSource.gallery),
              style: OutlinedButton.styleFrom(
                foregroundColor: RxColors.amberDeep,
                side: const BorderSide(color: RxColors.line),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              ),
              child: const Text('+ + Add another photo'),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ElevatedButton(
              onPressed: _reading ? null : _read,
              child: _reading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: RxColors.paper),
                    )
                  : const Text('Read with AI'),
            ),
            const SizedBox(width: 10),
            OutlinedButton(
              onPressed: _reading ? null : () => setState(() => _images.clear()),
              style: OutlinedButton.styleFrom(
                foregroundColor: RxColors.inkSoft,
                side: const BorderSide(color: RxColors.line),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              ),
              child: const Text('Start over'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildNotice(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: RxColors.danger.withValues(alpha: 0.08),
        border: Border.all(color: RxColors.danger.withValues(alpha: 0.25)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        text,
        style: const TextStyle(fontSize: 13, color: RxColors.dangerDeep, height: 1.5),
      ),
    );
  }
}
