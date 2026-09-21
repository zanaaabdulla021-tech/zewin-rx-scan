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
  List<dynamic> _activityLog = [];
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
      final logs = await _api.getActivityLogs();
      if (!mounted) return;
      setState(() {
        _branches = branches;
        _users = users;
        _activityLog = logs;
        _userBranchId ??= branches.isNotEmpty ? branches.first.id : null;
      });
    } catch (_) {
      // keep whatever was last loaded
    }
    if (mounted) setState(() => _loading = false);
  }

  String _activityLabel(String action) {
    const map = {
      'login': 'Logged in',
      'company_registered': 'Company registered',
      'branch_created': 'Branch created',
      'branch_deleted': 'Branch deleted',
      'user_created': 'User created',
      'user_deleted': 'User deleted',
      'prescription_scanned': 'Prescription scanned',
      'prescription_approved': 'Prescription approved',
      'prescription_rejected': 'Prescription rejected',
      'prescription_deleted': 'Prescription deleted',
    };
    return map[action] ?? action;
  }

  Future<void> _addBranch() async {
    final name = _branchNameCtrl.text.trim();
    if (name.isEmpty) return;
    try {
      await _api.addBranch(name);
      _branchNameCtrl.clear();
      _load();
    } catch (e) {
      if (!mounted) return;
      String msg = 'Something went wrong. Please try again.';
      if (e is ApiException && e.errorCode == 'plan_limit_reached') {
        final max = e.body?['max'];
        msg = 'Your plan allows up to $max branches. Ask the platform admin to upgrade your plan.';
      }
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
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
      String msg = 'That email is already taken, or something went wrong';
      if (e is ApiException && e.errorCode == 'plan_limit_reached') {
        final max = e.body?['max'];
        msg = 'Your plan allows up to $max users. Ask the platform admin to upgrade your plan.';
      }
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
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
          const Text('Branches', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
          const SizedBox(height: 10),
          ..._branches.map((b) => _row(b.name, '', () async {
                await _api.deleteBranch(b.id);
                _load();
              })),
          if (_branches.isEmpty) _emptyLine('No branches'),
          const SizedBox(height: 12),
          _card(Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _branchNameCtrl,
                  decoration: const InputDecoration(hintText: 'New branch name'),
                ),
              ),
              const SizedBox(width: 10),
              ElevatedButton(onPressed: _addBranch, child: const Text('Add')),
            ],
          )),
          const SizedBox(height: 28),
          const Text('Users', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
          const SizedBox(height: 10),
          ..._users.map((u) => _userRow(u)),
          if (_users.isEmpty) _emptyLine('No users'),
          const SizedBox(height: 12),
          _card(Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _userEmailCtrl,
                decoration: const InputDecoration(hintText: 'Email'),
                textDirection: TextDirection.ltr,
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _userPassCtrl,
                decoration: const InputDecoration(hintText: 'Initial password'),
                textDirection: TextDirection.ltr,
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                value: _userRole,
                items: const [
                  DropdownMenuItem(value: 'employee', child: Text('Employee')),
                  DropdownMenuItem(value: 'viewer', child: Text('Viewer (read-only)')),
                  DropdownMenuItem(value: 'branch_manager', child: Text('Branch manager')),
                  DropdownMenuItem(value: 'company_admin', child: Text('Company admin')),
                  DropdownMenuItem(value: 'owner', child: Text('Owner')),
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
              ElevatedButton(onPressed: _addUser, child: const Text('Add user')),
            ],
          )),
          const SizedBox(height: 24),
          const Text('Activity log', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
          const SizedBox(height: 10),
          if (_activityLog.isEmpty) _emptyLine('No activity yet'),
          ..._activityLog.map((l) => _activityRow(l as Map<String, dynamic>)),
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

  Widget _activityRow(Map<String, dynamic> l) {
    final when = DateTime.tryParse(l['createdAt'] as String? ?? '');
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: RxColors.paper2,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: RxColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(_activityLabel(l['action'] as String? ?? ''), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              if (when != null) Text(when.toLocal().toString(), style: const TextStyle(color: RxColors.inkSoft, fontSize: 11.5)),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            [l['userEmail'], l['details']].where((e) => e != null && (e as String).isNotEmpty).join(' · '),
            style: const TextStyle(color: RxColors.inkSoft, fontSize: 12.5),
          ),
        ],
      ),
    );
  }

  String _roleLabel(String role) {
    if (role == 'owner') return 'Owner';
    if (role == 'company_admin') return 'Company admin';
    if (role == 'branch_manager') return 'Branch manager';
    if (role == 'viewer') return 'Viewer';
    return 'Employee';
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
                Text('${_roleLabel(u.role)} · ${u.branchName ?? "No branch"}',
                    style: const TextStyle(fontSize: 12, color: RxColors.inkSoft)),
              ],
            ),
          ),
          TextButton(
            onPressed: () => _showResetPasswordDialog(u),
            child: const Text('Reset', style: TextStyle(color: RxColors.amberDeep, fontSize: 12.5)),
          ),
          TextButton(
            onPressed: () async {
              await _api.deleteUser(u.id);
              _load();
            },
            child: const Text('Delete', style: TextStyle(color: RxColors.danger, fontSize: 12.5)),
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
        title: Text('Reset password', style: TextStyle(fontSize: 15)),
        content: TextField(
          controller: ctrl,
          textDirection: TextDirection.ltr,
          decoration: const InputDecoration(hintText: 'New password'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, ctrl.text),
            child: const Text('Set'),
          ),
        ],
      ),
    );
    if (newPassword == null || newPassword.trim().length < 4) return;
    try {
      await _api.resetUserPassword(u.id, newPassword.trim());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password reset')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not be changed')));
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
            child: const Text('Delete', style: TextStyle(color: RxColors.danger, fontSize: 12.5)),
          ),
        ],
      ),
    );
  }
}
