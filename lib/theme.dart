import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Color tokens — kept in sync with the web prototype's palette so both
/// surfaces read as the same product.
class RxColors {
  RxColors._();

  static const bg = Color(0xFF122720);
  static const bg2 = Color(0xFF17332A);
  static const paper = Color(0xFFF6FAF8);
  static const paper2 = Color(0xFFE6F0EB);
  static const ink = Color(0xFF132019);
  static const inkSoft = Color(0xFF55685E);
  static const amber = Color(0xFF02B483);
  static const amberDeep = Color(0xFF019069);
  static const amberTint = Color(0xFFD8F5EA);
  static const stamp = Color(0xFF019069);
  static const stampDeep = Color(0xFF016E51);
  static const pending = Color(0xFFB8752E);
  static const pendingDeep = Color(0xFF8A5620);
  static const danger = Color(0xFFB3392B);
  static const dangerDeep = Color(0xFF8C2C20);
  static const line = Color(0x24132019); // ink @ 14%
}

class RxTheme {
  RxTheme._();

  static TextTheme _textTheme(TextTheme base) {
    // Vazirmatn covers Kurdish/Arabic script cleanly; falls back to the
    // platform's Arabic-capable system font if it can't be fetched.
    final body = GoogleFonts.vazirmatnTextTheme(base);
    return body;
  }

  static ThemeData get light {
    final base = ThemeData.light(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: RxColors.paper,
      colorScheme: base.colorScheme.copyWith(
        primary: RxColors.amber,
        secondary: RxColors.stamp,
        surface: RxColors.paper,
      ),
      textTheme: _textTheme(base.textTheme).apply(
        bodyColor: RxColors.ink,
        displayColor: RxColors.ink,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: RxColors.bg,
        foregroundColor: RxColors.paper,
        elevation: 0,
        titleTextStyle: GoogleFonts.playfairDisplay(
          color: RxColors.paper,
          fontSize: 20,
          fontWeight: FontWeight.w700,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: RxColors.paper,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9),
          borderSide: const BorderSide(color: RxColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9),
          borderSide: const BorderSide(color: RxColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9),
          borderSide: const BorderSide(color: RxColors.amberDeep, width: 1.6),
        ),
        labelStyle: const TextStyle(color: RxColors.inkSoft, fontSize: 12.5),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: RxColors.amber,
          foregroundColor: RxColors.paper,
          padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: RxColors.bg,
        selectedItemColor: RxColors.amberTint,
        unselectedItemColor: RxColors.paper.withValues(alpha: 0.5),
        type: BottomNavigationBarType.fixed,
      ),
      useMaterial3: true,
    );
  }
}
