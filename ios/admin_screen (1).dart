import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

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
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await AuthService.instance.login(_emailCtrl.text.trim(), _passCtrl.text);
      widget.onLoggedIn();
    } catch (e) {
      setState(() => _error = 'ئیمەیل یان وشەی نهێنی هەڵەیە');
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
                Text(
                  'خوێندنەوەی ڕەسیت',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.notoNaskhArabic(
                    fontWeight: FontWeight.w700,
                    fontSize: 20,
                    color: RxColors.ink,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'چوونەژوورەوە بە ئیمەیل و وشەی نهێنی',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: RxColors.inkSoft),
                ),
                const SizedBox(height: 22),
                TextField(
                  controller: _emailCtrl,
                  decoration: const InputDecoration(labelText: 'ئیمەیل'),
                  textDirection: TextDirection.ltr,
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _passCtrl,
                  decoration: const InputDecoration(labelText: 'وشەی نهێنی'),
                  textDirection: TextDirection.ltr,
                  obscureText: true,
                  onSubmitted: (_) => _submit(),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: RxColors.paper),
                        )
                      : const Text('چوونەژوورەوە'),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
                    decoration: BoxDecoration(
                      color: RxColors.stamp.withValues(alpha: 0.08),
                      border: Border.all(color: RxColors.stamp.withValues(alpha: 0.25)),
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Text(_error!, style: const TextStyle(color: RxColors.stampDeep, fontSize: 13)),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
