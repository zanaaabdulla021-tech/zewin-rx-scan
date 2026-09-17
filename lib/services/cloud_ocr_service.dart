import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../config.dart';
import 'auth_service.dart';

/// What the backend returns once it has read the prescription photo.
class CloudOcrResult {
  final String doctorName;
  final String phone;
  final List<String> medicines;

  const CloudOcrResult({
    required this.doctorName,
    required this.phone,
    required this.medicines,
  });
}

/// Thrown for every failure case; `reason` lets the caller decide whether
/// to fall back to on-device OCR silently or show a message.
class CloudOcrException implements Exception {
  final String reason;
  CloudOcrException(this.reason);
}

/// Sends the photo to the small backend in /backend, which forwards it to
/// a vision model that reads Kurdish and Arabic handwriting directly —
/// the thing on-device ML Kit cannot do.
class CloudOcrService {
  Future<CloudOcrResult> readImage(File image) async {
    if (AppConfig.backendUrl.isEmpty) {
      throw CloudOcrException('backend_not_configured');
    }

    final bytes = await image.readAsBytes();
    final base64Image = base64Encode(bytes);
    final mediaType = _guessMediaType(image.path);

    final uri = Uri.parse('${AppConfig.backendUrl}/api/scan');
    final token = AuthService.instance.token;
    late final http.Response res;
    try {
      res = await http
          .post(
            uri,
            headers: {
              'Content-Type': 'application/json',
              if (token != null) 'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'imageBase64': base64Image,
              'mediaType': mediaType,
            }),
          )
          .timeout(const Duration(seconds: 45));
    } catch (_) {
      throw CloudOcrException('network_error');
    }

    if (res.statusCode != 200) {
      throw CloudOcrException('server_error_${res.statusCode}');
    }

    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return CloudOcrResult(
      doctorName: (data['doctorName'] as String?) ?? '',
      phone: (data['phone'] as String?) ?? '',
      medicines: ((data['medicines'] as List?) ?? [])
          .map((e) => e.toString())
          .where((s) => s.trim().isNotEmpty)
          .toList(),
    );
  }

  String _guessMediaType(String path) {
    final lower = path.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }
}
