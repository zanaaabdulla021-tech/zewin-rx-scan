import 'dart:convert';

import 'package:flutter/material.dart';

import 'logo.dart';
import 'screens/account_screen.dart';
import 'screens/admin_screen.dart';
import 'screens/history_screen.dart';
import 'screens/login_screen.dart';
import 'screens/reports_screen.dart';
import 'screens/scan_screen.dart';
import 'screens/super_admin_screen.dart';
import 'services/api_service.dart';
import 'services/auth_service.dart';
import 'theme.dart';

void main() {
  runApp(const ZewinRxScanApp());
}

class ZewinRxScanApp extends StatelessWidget {
  const ZewinRxScanApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Rx Scan',
      debugShowCheckedModeBanner: false,
      theme: RxTheme.light,
      // Forced RTL: the interface is Sorani-only for now, independent of
      // the device locale's own text-direction resolution.
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child!,
      ),
      home: const _AuthGate(),
    );
  }
}

/// Resumes a stored session on launch, then shows the login screen or the
/// signed-in app shell.
class _AuthGate extends StatefulWidget {
  const _AuthGate();

  @override
  State<_AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<_AuthGate> {
  bool _checking = true;

  @override
  void initState() {
    super.initState();
    AuthService.instance.restore().whenComplete(() {
      if (mounted) setState(() => _checking = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(
        backgroundColor: RxColors.bg,
        body: Center(child: CircularProgressIndicator(color: RxColors.amberTint)),
      );
    }
    if (!AuthService.instance.isLoggedIn) {
      return LoginScreen(onLoggedIn: () => setState(() {}));
    }
    if (AuthService.instance.currentUser?.isSuperAdmin ?? false) {
      return SuperAdminScreen(
        onLoggedOut: () async {
          await AuthService.instance.logout();
          if (mounted) setState(() {});
        },
      );
    }
    return const _RootShell();
  }
}

class _RootShell extends StatefulWidget {
  const _RootShell();

  @override
  State<_RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<_RootShell> {
  int _tab = 0;
  final _historyKey = GlobalKey<HistoryScreenState>();
  int _unreadNotifications = 0;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    try {
      final data = await ApiService().getNotifications();
      if (mounted) setState(() => _unreadNotifications = data['unreadCount'] as int? ?? 0);
    } catch (_) {}
  }

  Future<void> _showNotifications() async {
    List<dynamic> notifications = [];
    try {
      final data = await ApiService().getNotifications();
      notifications = data['notifications'] as List? ?? [];
    } catch (_) {}
    if (!mounted) return;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        expand: false,
        builder: (context, scrollController) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Notifications', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  TextButton(
                    onPressed: () async {
                      await ApiService().markAllNotificationsRead();
                      if (mounted) Navigator.pop(context);
                      await _loadNotifications();
                    },
                    child: const Text('Mark all read'),
                  ),
                ],
              ),
            ),
            Expanded(
              child: notifications.isEmpty
                  ? const Center(child: Text('No notifications', style: TextStyle(color: RxColors.inkSoft)))
                  : ListView.builder(
                      controller: scrollController,
                      itemCount: notifications.length,
                      itemBuilder: (context, i) {
                        final n = notifications[i] as Map<String, dynamic>;
                        final read = n['read'] as bool? ?? false;
                        return ListTile(
                          title: Text(n['title'] as String? ?? '', style: TextStyle(fontWeight: read ? FontWeight.w400 : FontWeight.w700, fontSize: 13.5)),
                          subtitle: n['body'] != null ? Text(n['body'] as String, style: const TextStyle(fontSize: 12)) : null,
                          onTap: () async {
                            await ApiService().markNotificationRead(n['id'] as int);
                            await _loadNotifications();
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
    await _loadNotifications();
  }

  @override
  Widget build(BuildContext context) {
    final user = AuthService.instance.currentUser;
    final isOrgManager = user?.isOrgManager ?? false;
    final isOrgReader = user?.isOrgReader ?? false;
    final canScan = user?.canScan ?? true;

    final tabs = <Widget>[
      if (canScan) const ScanScreen(),
      HistoryScreen(key: _historyKey),
      if (isOrgReader) const ReportsScreen(),
      if (isOrgManager) const AdminScreen(),
      const AccountScreen(),
    ];
    final navItems = <BottomNavigationBarItem>[
      if (canScan) const BottomNavigationBarItem(icon: Icon(Icons.document_scanner_outlined), label: 'Scan'),
      const BottomNavigationBarItem(icon: Icon(Icons.history), label: 'History'),
      if (isOrgReader) const BottomNavigationBarItem(icon: Icon(Icons.bar_chart_outlined), label: 'Reports'),
      if (isOrgManager) const BottomNavigationBarItem(icon: Icon(Icons.admin_panel_settings_outlined), label: 'Admin'),
      const BottomNavigationBarItem(icon: Icon(Icons.person_outline), label: 'Account'),
    ];

    return Scaffold(
      appBar: AppBar(
        leading: Padding(
          padding: const EdgeInsets.all(10),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(9),
            child: Image.memory(base64Decode(kLogoBase64), fit: BoxFit.cover),
          ),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Rx Scan'),
            if (user != null)
              Text(
                '${user.organizationName != null ? "${user.organizationName} · " : ""}${user.branchName ?? "No branch"} · ${user.email}',
                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w400, color: RxColors.amberTint),
              ),
          ],
        ),
        actions: [
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_none),
                tooltip: 'Notifications',
                onPressed: _showNotifications,
              ),
              if (_unreadNotifications > 0)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    decoration: BoxDecoration(color: RxColors.danger, borderRadius: BorderRadius.circular(9)),
                    child: Text(
                      _unreadNotifications > 99 ? '99+' : '$_unreadNotifications',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
            ],
          ),
          if (user != null && user.hasMultipleCompanies)
            PopupMenuButton<int>(
              icon: const Icon(Icons.apartment_outlined),
              tooltip: 'Switch company',
              onSelected: (organizationId) async {
                try {
                  await AuthService.instance.switchCompany(organizationId);
                } catch (_) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Could not switch companies')),
                    );
                  }
                  return;
                }
                if (mounted) {
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (_) => const _AuthGate()),
                    (route) => false,
                  );
                }
              },
              itemBuilder: (context) => user.companies
                  .map((c) => PopupMenuItem(
                        value: c.organizationId,
                        child: Text(c.organizationName),
                      ))
                  .toList(),
            ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Log out',
            onPressed: () async {
              await AuthService.instance.logout();
              if (mounted) setState(() {});
              // Pop back to the AuthGate by rebuilding the whole tree.
              if (mounted) {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const _AuthGate()),
                  (route) => false,
                );
              }
            },
          ),
        ],
      ),
      body: IndexedStack(index: _tab, children: tabs),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _tab,
        onTap: (i) {
          setState(() => _tab = i);
          if (i == 1) _historyKey.currentState?.refresh();
        },
        items: navItems,
      ),
    );
  }
}
