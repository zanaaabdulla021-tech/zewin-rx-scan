import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../logo.dart';
import '../services/auth_service.dart';
import '../theme.dart';

class LoginScreen extends StatefulWidget {
  final VoidCallback onLoggedIn;
  const LoginScreen({super.key, required this.onLoggedIn});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();

  final _orgNameCtrl = TextEditingController();
  final _branchNameCtrl = TextEditingController();
  final _regEmailCtrl = TextEditingController();
  final _regPassCtrl = TextEditingController();

  bool _showRegister = false;
  bool _loading = false;
  String? _error;

  Future<void> _submitLogin() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await AuthService.instance.login(_emailCtrl.text.trim(), _passCtrl.text);
      widget.onLoggedIn();
    } catch (e) {
      setState(() => _error = 'Incorrect email or password');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submitRegister() async {
    final orgName = _orgNameCtrl.text.trim();
    final email = _regEmailCtrl.text.trim();
    final password = _regPassCtrl.text;
    if (orgName.isEmpty || email.isEmpty || password.isEmpty) {
      setState(() => _error = 'Please fill in the pharmacy name, email, and password');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await AuthService.instance.registerOrganization(
        organizationName: orgName,
        branchName: _branchNameCtrl.text.trim(),
        adminEmail: email,
        adminPassword: password,
      );
      widget.onLoggedIn();
    } catch (e) {
      setState(() => _error = 'That email is already taken, or something went wrong');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: RxColors.bg,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Container(
            width: 340,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: RxColors.paper,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(15),
                    child: Image.memory(
                      base64Decode(kLogoBase64),
                      width: 56,
                      height: 56,
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'Rx Scan',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.playfairDisplay(
                    fontWeight: FontWeight.w700,
                    fontSize: 20,
                    color: RxColors.ink,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _showRegister
                      ? 'Creates a new, fully separate account for your pharmacy'
                      : 'Log in with your email and password',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13, color: RxColors.inkSoft),
                ),
                const SizedBox(height: 22),
                if (!_showRegister) ..._loginFields() else ..._registerFields(),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _loading ? null : (_showRegister ? _submitRegister : _submitLogin),
                  child: _loading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: RxColors.paper),
                        )
                      : Text(_showRegister ? 'Create pharmacy account' : 'Log in'),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
                    decoration: BoxDecoration(
                      color: RxColors.danger.withValues(alpha: 0.08),
                      border: Border.all(color: RxColors.danger.withValues(alpha: 0.25)),
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Text(_error!, style: const TextStyle(color: RxColors.dangerDeep, fontSize: 13)),
                  ),
                ],
                const SizedBox(height: 14),
                TextButton(
                  onPressed: _loading
                      ? null
                      : () => setState(() {
                            _showRegister = !_showRegister;
                            _error = null;
                          }),
                  child: Text(
                    _showRegister ? 'Back to log in' : 'Register your pharmacy',
                    style: const TextStyle(fontSize: 12.5, color: RxColors.amberDeep),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _loginFields() {
    return [
      TextField(
        controller: _emailCtrl,
        decoration: const InputDecoration(labelText: 'Email'),
        textDirection: TextDirection.ltr,
        keyboardType: TextInputType.emailAddress,
      ),
      const SizedBox(height: 12),
      TextField(
        controller: _passCtrl,
        decoration: const InputDecoration(labelText: 'Password'),
        textDirection: TextDirection.ltr,
        obscureText: true,
        onSubmitted: (_) => _submitLogin(),
      ),
    ];
  }

  List<Widget> _registerFields() {
    return [
      TextField(
        controller: _orgNameCtrl,
        decoration: const InputDecoration(labelText: 'Pharmacy name'),
      ),
      const SizedBox(height: 12),
      TextField(
        controller: _branchNameCtrl,
        decoration: const InputDecoration(labelText: 'First branch name (optional)'),
      ),
      const SizedBox(height: 12),
      TextField(
        controller: _regEmailCtrl,
        decoration: const InputDecoration(labelText: 'Your email'),
        textDirection: TextDirection.ltr,
        keyboardType: TextInputType.emailAddress,
      ),
      const SizedBox(height: 12),
      TextField(
        controller: _regPassCtrl,
        decoration: const InputDecoration(labelText: 'Choose a password'),
        textDirection: TextDirection.ltr,
        obscureText: true,
        onSubmitted: (_) => _submitRegister(),
      ),
    ];
  }
}
