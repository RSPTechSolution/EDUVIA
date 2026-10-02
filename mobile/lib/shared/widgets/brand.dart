import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// The leaf mark on a white rounded tile, readable on any background.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 56});
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(size * 0.22),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 12, offset: const Offset(0, 4))],
        ),
        clipBehavior: Clip.antiAlias,
        child: Image.asset('assets/brand/icon.png', semanticLabel: 'EDUVIA'),
      );
}

/// "EDU" in the text colour, "VIA" in the logo gradient.
class Wordmark extends StatelessWidget {
  const Wordmark({super.key, this.fontSize = 26, this.suffix});
  final double fontSize;
  final String? suffix;

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).textTheme.headlineSmall!.copyWith(fontSize: fontSize, fontWeight: FontWeight.w800, letterSpacing: -0.5);
    return Semantics(
      label: suffix == null ? 'EDUVIA' : 'EDUVIA $suffix',
      excludeSemantics: true,
      child: Row(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
        Text('EDU', style: base),
        ShaderMask(
          shaderCallback: (r) => const LinearGradient(colors: [Color(0xFF2AA7F0), Brand.teal, Brand.green]).createShader(r),
          child: Text('VIA', style: base.copyWith(color: Colors.white)),
        ),
        if (suffix != null) ...[
          const SizedBox(width: 6),
          Text(suffix!, style: base.copyWith(fontWeight: FontWeight.w500, color: Theme.of(context).colorScheme.onSurfaceVariant)),
        ],
      ]),
    );
  }
}
