import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';
import '../models/user.dart';

class AuthException implements Exception {
  final String reason;
  AuthException(this.reason);
}

/// Holds the signed-in session in memory and mirrors the token to
/// shared_preferences so the app can resume without asking again.
class AuthService {
  AuthService._internal();
  static final AuthService instance = AuthService._internal();

  String? _token;
  AppUser? _user;

  String? get token => _token;
  AppUser? get currentUser => _user;
  bool get isLoggedIn => _token != null && _user != null;

  /// Call once at startup: resumes a stored session, if any and still valid.
  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('rxscan_token');
    if (_token == null) return;
    try {
      await fetchMe();
    } catch (_) {
      await logout();
    }
  }

  Future<AppUser> login(String email, String password) async {
    if (AppConfig.backendUrl.isEmpty) {
      throw AuthException('backend_not_configured');
    }
    final uri = Uri.parse('${AppConfig.backendUrl}/api/auth/login');
    late final http.Response res;
    try {
      res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password}),
      ).timeout(const Duration(seconds: 20));
    } catch (_) {
      throw AuthException('network_error');
    }
    if (res.statusCode != 200) {
      throw AuthException('invalid_credentials');
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    _token = data['token'] as String;
    _user = AppUser.fromJson({
      ...(data['user'] as Map<String, dynamic>),
      'companies': data['companies'],
    });

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('rxscan_token', _token!);
    return _user!;
  }

  Future<AppUser> registerOrganization({
    required String organizationName,
    required String branchName,
    required String adminEmail,
    required String adminPassword,
  }) async {
    if (AppConfig.backendUrl.isEmpty) {
      throw AuthException('backend_not_configured');
    }
    final uri = Uri.parse('${AppConfig.backendUrl}/api/auth/register-organization');
    late final http.Response res;
    try {
      res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'organizationName': organizationName,
          'branchName': branchName,
          'adminEmail': adminEmail,
          'adminPassword': adminPassword,
        }),
      ).timeout(const Duration(seconds: 20));
    } catch (_) {
      throw AuthException('network_error');
    }
    if (res.statusCode != 201) {
      throw AuthException('registration_failed');
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    _token = data['token'] as String;
    _user = AppUser.fromJson({
      ...(data['user'] as Map<String, dynamic>),
      'companies': data['companies'],
    });

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('rxscan_token', _token!);
    return _user!;
  }

  Future<AppUser> fetchMe() async {
    final uri = Uri.parse('${AppConfig.backendUrl}/api/auth/me');
    final res = await http.get(uri, headers: {'Authorization': 'Bearer $_token'});
    if (res.statusCode != 200) throw AuthException('session_expired');
    _user = AppUser.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
    return _user!;
  }

  /// Switch which company this login is currently acting as, without
  /// logging out. Only works for a company the person actually belongs to.
  Future<AppUser> switchCompany(int organizationId) async {
    final uri = Uri.parse('${AppConfig.backendUrl}/api/auth/switch-company');
    late final http.Response res;
    try {
      res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $_token'},
        body: jsonEncode({'organizationId': organizationId}),
      ).timeout(const Duration(seconds: 20));
    } catch (_) {
      throw AuthException('network_error');
    }
    if (res.statusCode != 200) throw AuthException('switch_failed');
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    _token = data['token'] as String;
    _user = AppUser.fromJson({
      ...(data['user'] as Map<String, dynamic>),
      'companies': data['companies'],
    });
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('rxscan_token', _token!);
    return _user!;
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('rxscan_token');
  }
}
