import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../theme.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final _curCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  bool _saving = false;
  bool _uploadingAvatar = false;
  String? _message;
  bool _success = false;

  String _roleLabel(String role) {
    if (role == 'admin') return 'بەڕێوەبەر';
    if (role == 'manager') return 'مودیر';
    return 'کارمەند';
  }

  Future<void> _pickAvatar() async {
    final picker = ImagePicker();
    final xfile = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (xfile == null) return;
    setState(() => _uploadingAvatar = true);
    try {
      final bytes = await File(xfile.path).readAsBytes();
      final b64 = base64Encode(bytes);
      final path = xfile.path.toLowerCase();
      final mediaType = path.endsWith('.png')
          ? 'image/png'
          : path.endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg';
      await ApiService().uploadAvatar(imageBase64: b64, mediaType: mediaType);
      await AuthService.instance.fetchMe();
      if (mounted) setState(() {});
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('نەتوانرا وێنەکە باربکرێت')));
      }
    } finally {
      if (mounted) setState(() => _uploadingAvatar = false);
    }
  }

  Future<void> _submit() async {
    final cur = _curCtrl.text;
    final next = _newCtrl.text;
    if (cur.isEmpty || next.isEmpty) {
      setState(() {
        _success = false;
        _message = 'هەردوو خانەکە پڕ بکەوە';
      });
      return;
    }
    setState(() {
      _saving = true;
      _message = null;
    });
    try {
      await ApiService().changePassword(currentPassword: cur, newPassword: next);
      _curCtrl.clear();
      _newCtrl.clear();
      setState(() {
        _success = true;
        _message = 'وشەی نهێنی گۆڕدرا';
      });
    } catch (e) {
      setState(() {
        _success = false;
        _message = 'وشەی نهێنی ئێستا هەڵەیە یان نوێیەکە زۆر کورتە';
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = AuthService.instance.currentUser;
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        const Text('وێنەی هەژمار', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
        const SizedBox(height: 10),
        Row(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: RxColors.paper2,
                border: Border.all(color: RxColors.line),
                image: (user?.avatarData != null)
                    ? DecorationImage(
                        image: MemoryImage(base64Decode(user!.avatarData!.split(',').last)),
                        fit: BoxFit.cover,
                      )
                    : null,
              ),
              child: user?.avatarData == null
                  ? const Icon(Icons.person_outline, color: RxColors.inkSoft, size: 28)
                  : null,
            ),
            const SizedBox(width: 14),
            _uploadingAvatar
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: RxColors.amberDeep))
                : TextButton(onPressed: _pickAvatar, child: const Text('گۆڕینی وێنە')),
          ],
        ),
        const SizedBox(height: 26),
        const Text('زانیاری هەژمار', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
        const SizedBox(height: 10),
        if (user != null) ...[
          _infoRow('ئیمەیل', user.email),
          _infoRow('ڕۆڵ', _roleLabel(user.role)),
          _infoRow('لق', user.branchName ?? 'بێ لق'),
        ],
        const SizedBox(height: 26),
        const Text('گۆڕینی وشەی نهێنی', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
        const SizedBox(height: 10),
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
              TextField(
                controller: _curCtrl,
                obscureText: true,
                textDirection: TextDirection.ltr,
                decoration: const InputDecoration(labelText: 'وشەی نهێنی ئێستا'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _newCtrl,
                obscureText: true,
                textDirection: TextDirection.ltr,
                decoration: const InputDecoration(labelText: 'وشەی نهێنی نوێ'),
              ),
              const SizedBox(height: 14),
              ElevatedButton(
                onPressed: _saving ? null : _submit,
                child: _saving
                    ? const SizedBox(
                        width: 16, height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: RxColors.paper))
                    : const Text('گۆڕین'),
              ),
              if (_message != null) ...[
                const SizedBox(height: 10),
                Text(
                  _message!,
                  style: TextStyle(
                    fontSize: 13,
                    color: _success ? const Color(0xFF3E5A2C) : RxColors.stampDeep,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _infoRow(String label, String value) {
    return Container(
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
          Text(label, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
          Text(value, style: const TextStyle(fontSize: 13, color: RxColors.inkSoft)),
        ],
      ),
    );
  }
}
