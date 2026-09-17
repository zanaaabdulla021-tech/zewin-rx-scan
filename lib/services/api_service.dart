import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';
import '../models/branch.dart';
import '../models/prescription.dart';
import '../models/user.dart';
import 'auth_service.dart';

class ApiException implements Exception {
  final String reason;
  final int? status;
  ApiException(this.reason, {this.status});
}

class ApiService {
  Future<dynamic> _request(String method, String path, {Map<String, dynamic>? body}) async {
    final token = AuthService.instance.token;
    final uri = Uri.parse('${AppConfig.backendUrl}$path');
    final headers = {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };

    http.Response res;
    try {
      switch (method) {
        case 'GET':
          res = await http.get(uri, headers: headers);
          break;
        case 'POST':
          res = await http.post(uri, headers: headers, body: body != null ? jsonEncode(body) : null);
          break;
        case 'DELETE':
          res = await http.delete(uri, headers: headers);
          break;
        default:
          throw ApiException('unsupported_method');
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('network_error');
    }

    if (res.statusCode == 401) {
      await AuthService.instance.logout();
      throw ApiException('unauthorized', status: 401);
    }
    if (res.statusCode >= 400) {
      throw ApiException('request_failed', status: res.statusCode);
    }
    if (res.body.isEmpty) return null;
    return jsonDecode(res.body);
  }

  // ---- prescriptions ----

  Future<List<Prescription>> getPrescriptions() async {
    final data = await _request('GET', '/api/prescriptions') as List;
    return data.map((e) => Prescription.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> savePrescription({
    required String doctorName,
    required String phone,
    required List<String> medicines,
    required String category,
    required String source,
    List<Map<String, String>>? images,
  }) {
    return _request('POST', '/api/prescriptions', body: {
      'doctorName': doctorName,
      'phone': phone,
      'medicines': medicines,
      'category': category,
      'source': source,
      if (images != null && images.isNotEmpty) 'images': images,
    });
  }

  Future<String?> getItemImage(String name) async {
    final data = await _request('GET', '/api/item-image?name=${Uri.encodeComponent(name)}')
        as Map<String, dynamic>;
    return data['imageData'] as String?;
  }

  Future<List<String>> getPrescriptionImages(int id) async {
    final data = await _request('GET', '/api/prescriptions/$id/images') as Map<String, dynamic>;
    final list = (data['images'] as List? ?? []);
    return list.map((e) => (e as Map<String, dynamic>)['imageData'] as String).toList();
  }

  Future<void> deletePrescription(int id) => _request('DELETE', '/api/prescriptions/$id');

  Future<void> approvePrescription(int id) => _request('POST', '/api/prescriptions/$id/approve');
  Future<void> rejectPrescription(int id) => _request('POST', '/api/prescriptions/$id/reject');

  // ---- branches (admin) ----

  Future<List<Branch>> getBranches() async {
    final data = await _request('GET', '/api/branches') as List;
    return data.map((e) => Branch.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> addBranch(String name) => _request('POST', '/api/branches', body: {'name': name});
  Future<void> deleteBranch(int id) => _request('DELETE', '/api/branches/$id');

  // ---- users (admin) ----

  Future<List<AppUser>> getUsers() async {
    final data = await _request('GET', '/api/users') as List;
    return data.map((e) => AppUser.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> addUser({
    required String email,
    required String password,
    required String role,
    int? branchId,
  }) {
    return _request('POST', '/api/users', body: {
      'email': email,
      'password': password,
      'role': role,
      'branchId': branchId,
    });
  }

  Future<void> deleteUser(int id) => _request('DELETE', '/api/users/$id');

  Future<void> resetUserPassword(int id, String newPassword) =>
      _request('POST', '/api/users/$id/reset-password', body: {'newPassword': newPassword});

  // ---- account ----

  Future<void> changePassword({required String currentPassword, required String newPassword}) {
    return _request('POST', '/api/auth/change-password', body: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }

  Future<String?> uploadAvatar({required String imageBase64, required String mediaType}) async {
    final data = await _request('POST', '/api/auth/avatar', body: {
      'imageBase64': imageBase64,
      'mediaType': mediaType,
    }) as Map<String, dynamic>;
    return data['avatarData'] as String?;
  }

  // ---- reports (admin) ----

  Future<Map<String, dynamic>> getReportsOverview() async {
    return await _request('GET', '/api/reports/overview') as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getDoctorReport(String name) async {
    return await _request('GET', '/api/reports/doctor?name=${Uri.encodeComponent(name)}')
        as Map<String, dynamic>;
  }
}
