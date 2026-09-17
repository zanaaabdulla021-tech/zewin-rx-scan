import 'package:flutter/material.dart';

import '../models/branch.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../theme.dart';

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  final _api = ApiService();
  List<Branch> _branches = [];
  List<AppUser> _users = [];
  bool _loading = true;

  final _branchNameCtrl = TextEditingController();
  final _userEmailCtrl = TextEditingController();
  final _userPassCtrl = TextEditingController();
  String _userRole = 'employee';
  int? _userBranchId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final branches = await _api.getBranches();
      final users = await _api.getUsers();
      if (!mounted) return;
      setState(() {
        _branches = branches;
        _users = users;
        _userBranchId ??= branches.isNotEmpty ? branches.first.id : null;
      });
    } catch (_) {
      // keep whatever was last loaded
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _addBranch() async {
    final name = _branchNameCtrl.text.trim();
    if (name.isEmpty) return;
    await _api.addBranch(name);
    _branchNameCtrl.clear();
    _load();
  }

  Future<void> _addUser() async {
    final email = _userEmailCtrl.text.trim();
    final pass = _userPassCtrl.text;
    if (email.isEmpty || pass.isEmpty) return;
    try {
      await _api.addUser(email: email, password: pass, role: _userRole, branchId: _userBranchId);
      _userEmailCtrl.clear();
      _userPassCtrl.clear();
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('ئیمەیلەکە پێشتر بەکارهاتووە یان هەڵەیەک ڕوویدا')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: RxColors.amberDeep));
    }
    return RefreshIndicator(
      onRefresh: _load,
      color: RxColors.amberDeep,
      child: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          const Text('لقەکان', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
          const SizedBox(height: 10),
          ..._branches.map((b) => _row(b.name, '', () async {
                await _api.deleteBranch(b.id);
                _load();
              })),
          if (_branches.isEmpty) _emptyLine('هیچ لقێک نییە'),
          const SizedBox(height: 12),
          _card(Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _branchNameCtrl,
                  decoration: const InputDecoration(hintText: 'ناوی لقی نوێ'),
                ),
              ),
              const SizedBox(width: 10),
              ElevatedButton(onPressed: _addBranch, child: const Text('زیادکردن')),
            ],
          )),
          const SizedBox(height: 28),
          const Text('یوزەرەکان', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
          const SizedBox(height: 10),
          ..._users.map((u) => _userRow(u)),
          if (_users.isEmpty) _emptyLine('هیچ یوزەرێک نییە'),
          const SizedBox(height: 12),
          _card(Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _userEmailCtrl,
                decoration: const InputDecoration(hintText: 'ئیمەیل'),
                textDirection: TextDirection.ltr,
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _userPassCtrl,
                decoration: const InputDecoration(hintText: 'وشەی نهێنی سەرەتایی'),
                textDirection: TextDirection.ltr,
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                value: _userRole,
                items: const [
                  DropdownMenuItem(value: 'employee', child: Text('کارمەند')),
                  DropdownMenuItem(value: 'manager', child: Text('مودیر')),
                  DropdownMenuItem(value: 'admin', child: Text('بەڕێوەبەر')),
                ],
                onChanged: (v) => setState(() => _userRole = v ?? 'employee'),
              ),
              if (_branches.isNotEmpty) ...[
                const SizedBox(height: 10),
                DropdownButtonFormField<int>(
                  value: _userBranchId,
                  items: _branches
                      .map((b) => DropdownMenuItem(value: b.id, child: Text(b.name)))
                      .toList(),
                  onChanged: (v) => setState(() => _userBranchId = v),
                ),
              ],
              const SizedBox(height: 12),
              ElevatedButton(onPressed: _addUser, child: const Text('زیادکردنی یوزەر')),
            ],
          )),
        ],
      ),
    );
  }

  Widget _card(Widget child) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: RxColors.paper2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: RxColors.line),
      ),
      child: child,
    );
  }

  Widget _emptyLine(String text) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(text, style: const TextStyle(fontSize: 13, color: RxColors.inkSoft)),
      );

  String _roleLabel(String role) {
    if (role == 'admin') return 'بەڕێوەبەر';
    if (role == 'manager') return 'مودیر';
    return 'کارمەند';
  }

  Widget _userRow(AppUser u) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: RxColors.paper2,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: RxColors.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(u.email, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                Text('${_roleLabel(u.role)} · ${u.branchName ?? "بێ لق"}',
                    style: const TextStyle(fontSize: 12, color: RxColors.inkSoft)),
              ],
            ),
          ),
          TextButton(
            onPressed: () => _showResetPasswordDialog(u),
            child: const Text('دووبارە دانان', style: TextStyle(color: RxColors.amberDeep, fontSize: 12.5)),
          ),
          TextButton(
            onPressed: () async {
              await _api.deleteUser(u.id);
              _load();
            },
            child: const Text('سڕینەوە', style: TextStyle(color: RxColors.stamp, fontSize: 12.5)),
          ),
        ],
      ),
    );
  }

  Future<void> _showResetPasswordDialog(AppUser u) async {
    final ctrl = TextEditingController();
    final newPassword = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: RxColors.paper,
        title: Text('دووبارە دانانی وشەی نهێنی', style: TextStyle(fontSize: 15)),
        content: TextField(
          controller: ctrl,
          textDirection: TextDirection.ltr,
          decoration: const InputDecoration(hintText: 'وشەی نهێنی نوێ'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('هەڵوەشاندنەوە')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, ctrl.text),
            child: const Text('دانان'),
          ),
        ],
      ),
    );
    if (newPassword == null || newPassword.trim().length < 4) return;
    try {
      await _api.resetUserPassword(u.id, newPassword.trim());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('وشەی نهێنی نوێ کرایەوە')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('نەتوانرا بگۆڕدرێت')));
      }
    }
  }

  Widget _row(String title, String meta, VoidCallback onDelete) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: RxColors.paper2,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: RxColors.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                if (meta.isNotEmpty)
                  Text(meta, style: const TextStyle(fontSize: 12, color: RxColors.inkSoft)),
              ],
            ),
          ),
          TextButton(
            onPressed: onDelete,
            child: const Text('سڕینەوە', style: TextStyle(color: RxColors.stamp, fontSize: 12.5)),
          ),
        ],
      ),
    );
  }
}
