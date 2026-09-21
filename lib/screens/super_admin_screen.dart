import 'dart:convert';

import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../theme.dart';

class SuperAdminScreen extends StatefulWidget {
  final VoidCallback onLoggedOut;
  const SuperAdminScreen({super.key, required this.onLoggedOut});

  @override
  State<SuperAdminScreen> createState() => _SuperAdminScreenState();
}

class _SuperAdminScreenState extends State<SuperAdminScreen> {
  Map<String, dynamic>? _overview;
  List<dynamic> _companies = [];
  List<dynamic> _activityLog = [];
  List<dynamic> _pendingPayments = [];
  bool _loading = true;

  final _nameCtrl = TextEditingController();
  final _branchCtrl = TextEditingController();
  final _adminEmailCtrl = TextEditingController();
  final _adminPasswordCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _contactEmailCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _countryCtrl = TextEditingController();
  String _newPlan = 'free';
  String _newBillingCycle = 'monthly';
  bool _creating = false;

  final _newAdminEmailCtrl = TextEditingController();
  final _newAdminPasswordCtrl = TextEditingController();
  bool _creatingAdmin = false;
  String? _createAdminMsg;
  bool _createAdminOk = false;
  String? _createMsg;
  bool _createOk = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final overview = await ApiService().getSuperAdminOverview();
      final companies = await ApiService().getCompanies();
      final logs = await ApiService().getSuperAdminActivityLogs();
      final payments = await ApiService().getSuperAdminPayments(status: 'pending');
      if (mounted) setState(() {
        _overview = overview;
        _companies = companies;
        _activityLog = logs;
        _pendingPayments = payments;
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _setStatus(int id, String status) async {
    try {
      await ApiService().setCompanyStatus(id, status);
      await _load();
    } catch (_) {}
  }

  Future<void> _createSuperAdmin() async {
    final email = _newAdminEmailCtrl.text.trim();
    final password = _newAdminPasswordCtrl.text;
    if (email.isEmpty || password.isEmpty) {
      setState(() {
        _createAdminMsg = 'Email and password are required';
        _createAdminOk = false;
      });
      return;
    }
    setState(() {
      _creatingAdmin = true;
      _createAdminMsg = null;
    });
    try {
      await ApiService().createSuperAdmin(email: email, password: password);
      _newAdminEmailCtrl.clear();
      _newAdminPasswordCtrl.clear();
      setState(() {
        _createAdminMsg = 'Super admin created';
        _createAdminOk = true;
      });
    } catch (_) {
      setState(() {
        _createAdminMsg = 'That email is already taken, or something went wrong';
        _createAdminOk = false;
      });
    } finally {
      if (mounted) setState(() => _creatingAdmin = false);
    }
  }

  Future<void> _approvePayment(int id) async {
    try {
      await ApiService().approvePayment(id);
      await _load();
    } catch (_) {}
  }

  Future<void> _rejectPayment(int id) async {
    try {
      await ApiService().rejectPayment(id);
      await _load();
    } catch (_) {}
  }

  Future<void> _setPlan(int id, String plan) async {
    try {
      await ApiService().setCompanyPlan(id, plan);
      await _load();
    } catch (_) {}
  }

  Future<void> _setBillingCycle(int id, String billingCycle) async {
    try {
      await ApiService().setCompanyBillingCycle(id, billingCycle);
      await _load();
    } catch (_) {}
  }

  Future<void> _setExpiry(int id, DateTime? date) async {
    try {
      await ApiService().setCompanyExpiry(
        id,
        date == null ? null : '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
      );
      await _load();
    } catch (_) {}
  }

  Future<void> _delete(int id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete this company?'),
        content: const Text('This deletes everything in it — branches, users, and scans. This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: RxColors.danger)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ApiService().deleteCompany(id);
      await _load();
    } catch (_) {}
  }

  Future<void> _create() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      setState(() {
        _createMsg = 'Company name is required';
        _createOk = false;
      });
      return;
    }
    setState(() {
      _creating = true;
      _createMsg = null;
    });
    try {
      await ApiService().createCompany(
        name: name,
        branchName: _branchCtrl.text.trim(),
        adminEmail: _adminEmailCtrl.text.trim(),
        adminPassword: _adminPasswordCtrl.text,
        phone: _phoneCtrl.text.trim(),
        email: _contactEmailCtrl.text.trim(),
        city: _cityCtrl.text.trim(),
        country: _countryCtrl.text.trim(),
        plan: _newPlan,
        billingCycle: _newBillingCycle,
      );
      _nameCtrl.clear();
      _branchCtrl.clear();
      _adminEmailCtrl.clear();
      _adminPasswordCtrl.clear();
      _phoneCtrl.clear();
      _contactEmailCtrl.clear();
      _cityCtrl.clear();
      _countryCtrl.clear();
      setState(() {
        _createMsg = 'Company created';
        _createOk = true;
        _newPlan = 'free';
        _newBillingCycle = 'monthly';
      });
      await _load();
    } catch (_) {
      setState(() {
        _createMsg = 'That email is already taken, or something went wrong';
        _createOk = false;
      });
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  Color _statusColor(String status) {
    if (status == 'active') return RxColors.stampDeep;
    if (status == 'suspended' || status == 'expired') return RxColors.dangerDeep;
    return RxColors.pendingDeep;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: RxColors.paper,
      appBar: AppBar(
        title: const Text('Rx Scan — Platform'),
        actions: [
          IconButton(icon: const Icon(Icons.logout), tooltip: 'Log out', onPressed: widget.onLoggedOut),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(18),
                children: [
                  const Text('Platform overview', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: RxColors.inkSoft)),
                  const SizedBox(height: 8),
                  if (_overview != null) _overviewCard(_overview!),
                  const SizedBox(height: 24),
                  const Text('Create another super admin', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: RxColors.inkSoft)),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: RxColors.paper2,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: RxColors.line),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        TextField(controller: _newAdminEmailCtrl, decoration: const InputDecoration(labelText: 'Email'), textDirection: TextDirection.ltr),
                        const SizedBox(height: 10),
                        TextField(controller: _newAdminPasswordCtrl, decoration: const InputDecoration(labelText: 'Password'), textDirection: TextDirection.ltr),
                        const SizedBox(height: 10),
                        ElevatedButton(
                          onPressed: _creatingAdmin ? null : _createSuperAdmin,
                          child: _creatingAdmin
                              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                              : const Text('Create super admin'),
                        ),
                        if (_createAdminMsg != null) ...[
                          const SizedBox(height: 8),
                          Text(_createAdminMsg!, style: TextStyle(color: _createAdminOk ? RxColors.stampDeep : RxColors.dangerDeep, fontSize: 12.5)),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text('Payment requests', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: RxColors.inkSoft)),
                  const SizedBox(height: 8),
                  if (_pendingPayments.isEmpty)
                    const Text('No pending payment requests', style: TextStyle(color: RxColors.inkSoft))
                  else
                    ..._pendingPayments.map((p) => _paymentCard(p as Map<String, dynamic>)),
                  const SizedBox(height: 24),
                  const Text('Companies', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: RxColors.inkSoft)),
                  const SizedBox(height: 8),
                  if (_companies.isEmpty)
                    const Text('No companies yet', style: TextStyle(color: RxColors.inkSoft))
                  else
                    ..._companies.map((c) => _companyCard(c as Map<String, dynamic>)),
                  const SizedBox(height: 24),
                  const Text('Create a new company', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: RxColors.inkSoft)),
                  const SizedBox(height: 8),
                  _createForm(),
                  const SizedBox(height: 24),
                  const Text('Platform activity log', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: RxColors.inkSoft)),
                  const SizedBox(height: 8),
                  if (_activityLog.isEmpty)
                    const Text('No activity yet', style: TextStyle(color: RxColors.inkSoft))
                  else
                    ..._activityLog.map((l) => _activityRow(l as Map<String, dynamic>)),
                ],
              ),
            ),
    );
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
      'company_created': 'Company created',
      'company_status_changed': 'Company status changed',
      'company_plan_changed': 'Company plan changed',
      'company_deleted': 'Company deleted',
    };
    return map[action] ?? action;
  }

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
            [l['userEmail'], l['companyName'], l['details']]
                .where((e) => e != null && (e as String).isNotEmpty)
                .join(' · '),
            style: const TextStyle(color: RxColors.inkSoft, fontSize: 12.5),
          ),
        ],
      ),
    );
  }

  Widget _overviewCard(Map<String, dynamic> o) {
    Widget stat(String label, dynamic value) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: const TextStyle(color: RxColors.inkSoft, fontSize: 13)),
              Text('$value', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            ],
          ),
        );
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: RxColors.paper2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: RxColors.line),
      ),
      child: Column(
        children: [
          stat('Total companies', o['totalCompanies']),
          stat('Active', o['activeCompanies']),
          stat('Trial', o['trialCompanies']),
          stat('Suspended', o['suspendedCompanies']),
          stat('Total users', o['totalUsers']),
          stat('Total branches', o['totalBranches']),
          stat('Total scans', o['totalScans']),
          stat('Est. monthly revenue', '\$${o['estimatedMonthlyRevenue']}'),
        ],
      ),
    );
  }

  Widget _paymentCard(Map<String, dynamic> p) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: RxColors.paper2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: RxColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${p['companyName']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              Text('\$${p['amount']} ${p['currency']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${p['requestedBy'] ?? ''}${p['reference'] != null ? ' · ${p['reference']}' : ''}',
            style: const TextStyle(color: RxColors.inkSoft, fontSize: 12),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              OutlinedButton(
                onPressed: () => _approvePayment(p['id'] as int),
                style: OutlinedButton.styleFrom(foregroundColor: RxColors.stampDeep),
                child: const Text('Approve'),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: () => _rejectPayment(p['id'] as int),
                style: OutlinedButton.styleFrom(foregroundColor: RxColors.danger),
                child: const Text('Reject'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _companyCard(Map<String, dynamic> c) {
    final status = c['status'] as String? ?? 'trial';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: RxColors.paper2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: RxColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    if (c['logoData'] != null) ...[
                      ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: Image.memory(
                          base64Decode((c['logoData'] as String).split(',').last),
                          width: 24,
                          height: 24,
                          fit: BoxFit.cover,
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Flexible(
                      child: Text('${c['name']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                decoration: BoxDecoration(
                  color: _statusColor(status).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(status, style: TextStyle(color: _statusColor(status), fontSize: 11.5, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text('${c['branchCount']} branch, ${c['userCount']} users', style: const TextStyle(color: RxColors.inkSoft, fontSize: 12.5)),
          const SizedBox(height: 8),
          Row(
            children: [
              const Text('Plan: ', style: TextStyle(color: RxColors.inkSoft, fontSize: 12.5)),
              DropdownButton<String>(
                value: (c['plan'] as String?) ?? 'free',
                isDense: true,
                items: const [
                  DropdownMenuItem(value: 'free', child: Text('Free')),
                  DropdownMenuItem(value: 'basic', child: Text('Basic')),
                  DropdownMenuItem(value: 'business', child: Text('Business')),
                  DropdownMenuItem(value: 'enterprise', child: Text('Enterprise')),
                ],
                onChanged: (v) {
                  if (v != null) _setPlan(c['id'] as int, v);
                },
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Text('Billing: ', style: TextStyle(color: RxColors.inkSoft, fontSize: 12.5)),
              DropdownButton<String>(
                value: (c['billing']?['cycle'] as String?) ?? 'monthly',
                isDense: true,
                items: const [
                  DropdownMenuItem(value: 'monthly', child: Text('Monthly (\$10/branch)')),
                  DropdownMenuItem(value: 'yearly', child: Text('Yearly (\$100/branch)')),
                ],
                onChanged: (v) {
                  if (v != null) _setBillingCycle(c['id'] as int, v);
                },
              ),
              const SizedBox(width: 8),
              Text(
                '\$${c['billing']?['totalCost']}/${(c['billing']?['cycle'] == 'yearly') ? 'yr' : 'mo'}',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Text('Expires: ', style: TextStyle(color: RxColors.inkSoft, fontSize: 12.5)),
              Builder(builder: (context) {
                final expiryStr = c['expiryDate'] as String?;
                final expiry = expiryStr != null ? DateTime.tryParse(expiryStr) : null;
                final expired = expiry != null && expiry.isBefore(DateTime.now());
                return Text(
                  expiry != null
                      ? '${expiry.year}-${expiry.month.toString().padLeft(2, '0')}-${expiry.day.toString().padLeft(2, '0')}${expired ? ' (expired)' : ''}'
                      : 'Not set',
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: expired ? RxColors.dangerDeep : RxColors.ink),
                );
              }),
              const SizedBox(width: 8),
              TextButton(
                onPressed: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: DateTime.now().add(const Duration(days: 30)),
                    firstDate: DateTime(2020),
                    lastDate: DateTime(2100),
                  );
                  if (picked != null) _setExpiry(c['id'] as int, picked);
                },
                child: const Text('Change', style: TextStyle(fontSize: 12.5)),
              ),
              if (c['expiryDate'] != null)
                TextButton(
                  onPressed: () => _setExpiry(c['id'] as int, null),
                  child: const Text('Clear', style: TextStyle(fontSize: 12.5, color: RxColors.inkSoft)),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            children: [
              if (status != 'active')
                OutlinedButton(
                  onPressed: () => _setStatus(c['id'] as int, 'active'),
                  child: const Text('Activate'),
                ),
              if (status != 'suspended')
                OutlinedButton(
                  onPressed: () => _setStatus(c['id'] as int, 'suspended'),
                  style: OutlinedButton.styleFrom(foregroundColor: RxColors.dangerDeep),
                  child: const Text('Suspend'),
                ),
              OutlinedButton(
                onPressed: () => _delete(c['id'] as int),
                style: OutlinedButton.styleFrom(foregroundColor: RxColors.danger),
                child: const Text('Delete'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _createForm() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: RxColors.paper2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: RxColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Company / pharmacy name')),
          const SizedBox(height: 10),
          TextField(controller: _branchCtrl, decoration: const InputDecoration(labelText: 'First branch name', hintText: 'Main Branch')),
          const SizedBox(height: 10),
          TextField(controller: _adminEmailCtrl, decoration: const InputDecoration(labelText: 'Admin email'), textDirection: TextDirection.ltr),
          const SizedBox(height: 10),
          TextField(controller: _adminPasswordCtrl, decoration: const InputDecoration(labelText: 'Admin initial password'), textDirection: TextDirection.ltr),
          const SizedBox(height: 10),
          TextField(controller: _phoneCtrl, decoration: const InputDecoration(labelText: 'Phone (optional)'), textDirection: TextDirection.ltr),
          const SizedBox(height: 10),
          TextField(controller: _contactEmailCtrl, decoration: const InputDecoration(labelText: 'Contact email (optional)'), textDirection: TextDirection.ltr),
          const SizedBox(height: 10),
          TextField(controller: _cityCtrl, decoration: const InputDecoration(labelText: 'City (optional)')),
          const SizedBox(height: 10),
          TextField(controller: _countryCtrl, decoration: const InputDecoration(labelText: 'Country (optional)')),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: _newPlan,
            decoration: const InputDecoration(labelText: 'Plan'),
            items: const [
              DropdownMenuItem(value: 'free', child: Text('Free')),
              DropdownMenuItem(value: 'basic', child: Text('Basic')),
              DropdownMenuItem(value: 'business', child: Text('Business')),
              DropdownMenuItem(value: 'enterprise', child: Text('Enterprise')),
            ],
            onChanged: (v) => setState(() => _newPlan = v ?? 'free'),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: _newBillingCycle,
            decoration: const InputDecoration(labelText: 'Billing'),
            items: const [
              DropdownMenuItem(value: 'monthly', child: Text('Monthly (\$10/branch)')),
              DropdownMenuItem(value: 'yearly', child: Text('Yearly (\$100/branch)')),
            ],
            onChanged: (v) => setState(() => _newBillingCycle = v ?? 'monthly'),
          ),
          const SizedBox(height: 14),
          ElevatedButton(
            onPressed: _creating ? null : _create,
            child: _creating
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Create company'),
          ),
          if (_createMsg != null) ...[
            const SizedBox(height: 8),
            Text(_createMsg!, style: TextStyle(color: _createOk ? RxColors.stampDeep : RxColors.dangerDeep, fontSize: 13)),
          ],
        ],
      ),
    );
  }
}
