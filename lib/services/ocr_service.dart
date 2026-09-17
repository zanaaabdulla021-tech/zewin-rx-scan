import 'dart:io';

import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

/// Result of reading a prescription photo.
class OcrResult {
  /// Every text line ML Kit found, top to bottom — offered as editable
  /// "medicine" candidates since drug names on local prescriptions are
  /// almost always written in Latin script even when the rest of the
  /// slip is in Kurdish or Arabic.
  final List<String> lines;

  /// Best-guess phone number pulled out of the recognized text, if any.
  final String? phone;

  const OcrResult({required this.lines, this.phone});
}

/// IMPORTANT LIMITATION (see README): Google ML Kit's on-device text
/// recognizer only reads Latin, Chinese, Devanagari, Japanese and Korean
/// script — it cannot read Kurdish or Arabic handwriting. This service is
/// a working Phase 1 baseline for the Latin-script parts of a prescription
/// (medicine names, some doctor names). Reading Kurdish/Arabic text
/// reliably needs a cloud vision model, the way the web prototype does it
/// — that's the natural Phase 2 addition once a small backend exists.
class OcrService {
  final _recognizer = TextRecognizer(script: TextRecognitionScript.latin);

  static final _phoneRegex = RegExp(r'(\+?\d[\d\s\-]{7,14}\d)');

  Future<OcrResult> readImage(String imagePath) async {
    final input = InputImage.fromFile(File(imagePath));
    final result = await _recognizer.processImage(input);

    final lines = <String>[];
    for (final block in result.blocks) {
      for (final line in block.lines) {
        final text = line.text.trim();
        if (text.isNotEmpty) lines.add(text);
      }
    }

    String? phone;
    final match = _phoneRegex.firstMatch(result.text);
    if (match != null) {
      phone = match.group(0)?.replaceAll(RegExp(r'\s+'), ' ').trim();
      lines.removeWhere((l) => l.contains(match.group(0)!));
    }

    return OcrResult(lines: lines, phone: phone);
  }

  void dispose() {
    _recognizer.close();
  }
}
