import 'package:flutter/material.dart';


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
        child: Image.asset('assets/brand/icon.png', semanticLabel: 'Vidyanexa'),
      );
}

/// The name as one word, in the text colour.
class Wordmark extends StatelessWidget {
  const Wordmark({super.key, this.fontSize = 26, this.suffix});
  final double fontSize;
  final String? suffix;

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).textTheme.headlineSmall!.copyWith(fontSize: fontSize, fontWeight: FontWeight.w800, letterSpacing: -0.5);
    return Semantics(
      label: suffix == null ? 'Vidyanexa' : 'Vidyanexa $suffix',
      excludeSemantics: true,
      child: Row(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
        // One word in one colour: never set "nexa" apart (keeps clear of other brands).
        Text('Vidyanexa', style: base),
        if (suffix != null) ...[
          const SizedBox(width: 6),
          Text(suffix!, style: base.copyWith(fontWeight: FontWeight.w500, color: Theme.of(context).colorScheme.onSurfaceVariant)),
        ],
      ]),
    );
  }
}
