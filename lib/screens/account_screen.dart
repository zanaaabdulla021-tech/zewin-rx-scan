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
  Map<String, dynamic>? _subscription;
  String? _companyLogoData;
  bool _uploadingLogo = false;
  List<dynamic> _paymentHistory = [];
  final _paymentReferenceCtrl = TextEditingController();
  bool _requestingPayment = false;
  String? _paymentMsg;
  bool _paymentOk = false;

  @override
  void initState() {
    super.initState();
    _loadSubscription();
  }

  Future<void> _loadSubscription() async {
    try {
      final data = await ApiService().getSubscription();
      if (mounted) setState(() {
        _subscription = data;
        _companyLogoData = data['logoData'] as String?;
      });
      final user = AuthService.instance.currentUser;
      if (user != null && (user.isOwner || user.isCompanyAdmin)) {
        await _loadPaymentHistory();
      }
    } catch (_) {}
  }

  Future<void> _loadPaymentHistory() async {
    try {
      final payments = await ApiService().getCompanyPayments();
      if (mounted) setState(() => _paymentHistory = payments);
    } catch (_) {}
  }

  Future<void> _requestPayment() async {
    setState(() {
      _requestingPayment = true;
      _paymentMsg = null;
    });
    try {
      await ApiService().requestCompanyPayment(reference: _paymentReferenceCtrl.text.trim());
      _paymentReferenceCtrl.clear();
      setState(() {
        _paymentMsg = 'Request sent — the platform admin will review it';
        _paymentOk = true;
      });
      await _loadPaymentHistory();
    } catch (_) {
      setState(() {
        _paymentMsg = 'Could not send the request';
        _paymentOk = false;
      });
    } finally {
      if (mounted) setState(() => _requestingPayment = false);
    }
  }

  String _roleLabel(String role) {
    if (role == 'owner') return 'Owner';
    if (role == 'company_admin') return 'Company admin';
    if (role == 'branch_manager') return 'Branch manager';
    if (role == 'viewer') return 'Viewer';
    if (role == 'super_admin') return 'Super admin';
    return 'Employee';
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
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not load the photo')));
      }
    } finally {
      if (mounted) setState(() => _uploadingAvatar = false);
    }
  }

  Future<void> _pickCompanyLogo() async {
    final picker = ImagePicker();
    final xfile = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (xfile == null) return;
    setState(() => _uploadingLogo = true);
    try {
      final bytes = await File(xfile.path).readAsBytes();
      final b64 = base64Encode(bytes);
      final path = xfile.path.toLowerCase();
      final mediaType = path.endsWith('.jpg') || path.endsWith('.jpeg')
          ? 'image/jpeg'
          : path.endsWith('.webp')
              ? 'image/webp'
              : 'image/png';
      final logoData = await ApiService().uploadCompanyLogo(imageBase64: b64, mediaType: mediaType);
      if (mounted) setState(() => _companyLogoData = logoData);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not load the logo')));
      }
    } finally {
      if (mounted) setState(() => _uploadingLogo = false);
    }
  }

  Future<void> _submit() async {
    final cur = _curCtrl.text;
    final next = _newCtrl.text;
    if (cur.isEmpty || next.isEmpty) {
      setState(() {
        _success = false;
        _message = 'Fill in both fields';
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
        _message = 'Password changed';
      });
    } catch (e) {
      setState(() {
        _success = false;
        _message = 'Current password is wrong, or the new one is too short';
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
        const Text('Profile photo', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
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
                : TextButton(onPressed: _pickAvatar, child: const Text('Change photo')),
          ],
        ),
        const SizedBox(height: 26),
        const Text('Account details', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
        const SizedBox(height: 10),
        if (user != null) ...[
          _infoRow('Pharmacy', user.organizationName ?? '—'),
          _infoRow('Email', user.email),
          _infoRow('Role', _roleLabel(user.role)),
          _infoRow('Branch', user.branchName ?? 'No branch'),
        ],
        if (user != null && (user.isOwner || user.isCompanyAdmin)) ...[
          const SizedBox(height: 26),
          const Text('Company logo', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
          const SizedBox(height: 10),
          Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: RxColors.paper2,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: RxColors.line),
                ),
                clipBehavior: Clip.antiAlias,
                child: _companyLogoData != null
                    ? Image.memory(base64Decode(_companyLogoData!.split(',').last), fit: BoxFit.cover)
                    : const Icon(Icons.image_outlined, color: RxColors.inkSoft),
              ),
              const SizedBox(width: 14),
              _uploadingLogo
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : TextButton(onPressed: _pickCompanyLogo, child: const Text('Change logo')),
            ],
          ),
        ],
        if (_subscription != null) ...[
          const SizedBox(height: 26),
          const Text('Subscription', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
          const SizedBox(height: 10),
          _infoRow('Plan', (_subscription!['limits']?['label'] as String?) ?? '—'),
          _infoRow('Status', (_subscription!['status'] as String?) ?? '—'),
          if (_subscription!['expiryDate'] != null)
            _infoRow('Expires', _expiryLine(_subscription!['expiryDate'] as String)),
          _infoRow('Branches', _usageLine(_subscription!, 'branches', 'maxBranches')),
          _infoRow('Users', _usageLine(_subscription!, 'users', 'maxUsers')),
          _infoRow('Scans this month', _usageLine(_subscription!, 'scansThisMonth', 'maxScansPerMonth')),
          _infoRow('Billing', '\$${_subscription!['billing']?['pricePerBranch']} / branch / ${(_subscription!['billing']?['cycle'] == 'yearly') ? 'year' : 'month'}'),
          _infoRow('Total (${_subscription!['billing']?['branchCount']} branch${_subscription!['billing']?['branchCount'] == 1 ? '' : 'es'})', '\$${_subscription!['billing']?['totalCost']} / ${(_subscription!['billing']?['cycle'] == 'yearly') ? 'year' : 'month'}'),
        ],
        if (user != null && (user.isOwner || user.isCompanyAdmin)) ...[
          const SizedBox(height: 26),
          const Text('Payment', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
          const SizedBox(height: 10),
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
                const Text(
                  'No payment gateway is connected yet — request activation manually and the platform admin will verify and activate your account.',
                  style: TextStyle(fontSize: 12, color: RxColors.inkSoft),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _paymentReferenceCtrl,
                  decoration: const InputDecoration(labelText: 'Payment reference / note (optional)'),
                ),
                const SizedBox(height: 10),
                ElevatedButton(
                  onPressed: _requestingPayment ? null : _requestPayment,
                  child: _requestingPayment
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Request activation'),
                ),
                if (_paymentMsg != null) ...[
                  const SizedBox(height: 8),
                  Text(_paymentMsg!, style: TextStyle(color: _paymentOk ? RxColors.stampDeep : RxColors.dangerDeep, fontSize: 12.5)),
                ],
              ],
            ),
          ),
          ..._paymentHistory.map((p) {
            final map = p as Map<String, dynamic>;
            final status = map['status'] as String? ?? 'pending';
            final color = status == 'approved' ? RxColors.stampDeep : (status == 'rejected' ? RxColors.dangerDeep : RxColors.pendingDeep);
            return Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('\$${map['amount']}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5)),
                  Text(status, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
                ],
              ),
            );
          }),
        ],
        const SizedBox(height: 26),
        const Text('Change password', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: RxColors.inkSoft)),
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
                decoration: const InputDecoration(labelText: 'Current password'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _newCtrl,
                obscureText: true,
                textDirection: TextDirection.ltr,
                decoration: const InputDecoration(labelText: 'New password'),
              ),
              const SizedBox(height: 14),
              ElevatedButton(
                onPressed: _saving ? null : _submit,
                child: _saving
                    ? const SizedBox(
                        width: 16, height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: RxColors.paper))
                    : const Text('Change'),
              ),
              if (_message != null) ...[
                const SizedBox(height: 10),
                Text(
                  _message!,
                  style: TextStyle(
                    fontSize: 13,
                    color: _success ? RxColors.stampDeep : RxColors.dangerDeep,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  String _usageLine(Map<String, dynamic> subscription, String usageKey, String limitKey) {
    final used = subscription['usage']?[usageKey];
    final max = subscription['limits']?[limitKey];
    if (max == null) return '$used (unlimited)';
    return '$used / $max';
  }

  String _expiryLine(String expiryDateIso) {
    final date = DateTime.tryParse(expiryDateIso);
    if (date == null) return expiryDateIso;
    final expired = date.isBefore(DateTime.now());
    final formatted = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    return expired ? '$formatted (expired)' : formatted;
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
