import 'package:flutter/material.dart';
import '../theme.dart';

/// The dashed, perforated-edge card used for the empty scan state — a nod
/// to a physical tear-off prescription slip.
class SlipCard extends StatelessWidget {
  final Widget child;
  const SlipCard({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _PerforationPainter(),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(18, 26, 18, 30),
        decoration: BoxDecoration(
          color: RxColors.paper2,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: RxColors.inkSoft,
            width: 1.4,
            style: BorderStyle.solid,
          ),
        ),
        child: child,
      ),
    );
  }
}

class _PerforationPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = RxColors.bg;
    const radius = 6.0;
    const spacing = 18.0;
    double x = spacing / 2;
    while (x < size.width) {
      canvas.drawCircle(Offset(x, size.height), radius, paint);
      x += spacing;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Stamp-styled primary action (used for "save") — a solid block rather
/// than a pill, echoing a pharmacist's approval stamp.
class StampButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  const StampButton({
    super.key,
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, size: 18),
        label: Text(label),
        style: ElevatedButton.styleFrom(
          backgroundColor: RxColors.stamp,
          foregroundColor: RxColors.amberTint,
          disabledBackgroundColor: RxColors.stamp.withValues(alpha: 0.5),
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
    );
  }
}
