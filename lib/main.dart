import 'dart:convert';

import 'package:flutter/material.dart';

import 'logo.dart';
import 'screens/account_screen.dart';
import 'screens/admin_screen.dart';
import 'screens/history_screen.dart';
import 'screens/login_screen.dart';
import 'screens/reports_screen.dart';
import 'screens/scan_screen.dart';
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

  @override
  Widget build(BuildContext context) {
    final user = AuthService.instance.currentUser;
    final isAdmin = user?.isAdmin ?? false;

    final tabs = <Widget>[
      const ScanScreen(),
      HistoryScreen(key: _historyKey),
      if (isAdmin) const ReportsScreen(),
      if (isAdmin) const AdminScreen(),
      const AccountScreen(),
    ];
    final navItems = <BottomNavigationBarItem>[
      const BottomNavigationBarItem(icon: Icon(Icons.document_scanner_outlined), label: 'Scan'),
      const BottomNavigationBarItem(icon: Icon(Icons.history), label: 'History'),
      if (isAdmin) const BottomNavigationBarItem(icon: Icon(Icons.bar_chart_outlined), label: 'Reports'),
      if (isAdmin) const BottomNavigationBarItem(icon: Icon(Icons.admin_panel_settings_outlined), label: 'Admin'),
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
                '${user.branchName ?? "No branch"} · ${user.email}',
                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w400, color: RxColors.amberTint),
              ),
          ],
        ),
        actions: [
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
