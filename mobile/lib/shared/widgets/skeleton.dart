import 'package:flutter/material.dart';

/// Skeletons shaped like the content that replaces them, so nothing jumps when data arrives.
/// A soft highlight sweeps across the bones; it stays still when the system asks for reduced motion.

/// Paints a moving highlight over every [Bone] below it.
class Shimmer extends StatefulWidget {
  const Shimmer({super.key, required this.child});
  final Widget child;

  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final base = dark ? Colors.white.withValues(alpha: 0.07) : Colors.black.withValues(alpha: 0.06);
    // A translucent band blended over the bones (srcATop keeps it inside them), so their own colour stays put.
    final glow = Colors.white.withValues(alpha: dark ? 0.07 : 0.55);
    return Semantics(
      label: 'Loading',
      liveRegion: true,
      child: ExcludeSemantics(
        child: AnimatedBuilder(
          animation: _c,
          child: widget.child,
          builder: (context, child) => _BoneColors(
            base: base,
            child: ShaderMask(
              blendMode: BlendMode.srcATop,
              shaderCallback: (rect) {
                final t = _c.value * 3 - 1; // sweep from off the left edge to off the right
                return LinearGradient(
                  begin: Alignment(t - 1, -0.3),
                  end: Alignment(t + 1, 0.3),
                  colors: [glow.withValues(alpha: 0), glow, glow.withValues(alpha: 0)],
                  stops: const [0.35, 0.5, 0.65],
                ).createShader(rect);
              },
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

class _BoneColors extends InheritedWidget {
  const _BoneColors({required this.base, required super.child});
  final Color base;

  @override
  bool updateShouldNotify(_BoneColors old) => old.base != base;
}

/// One grey placeholder shape.
class Bone extends StatelessWidget {
  const Bone({super.key, this.width, this.height = 12, this.radius = 6, this.circle = false});
  const Bone.circle(double size, {super.key}) : width = size, height = size, radius = 0, circle = true;
  final double? width;
  final double height;
  final double radius;
  final bool circle;

  @override
  Widget build(BuildContext context) {
    final color = context.dependOnInheritedWidgetOfExactType<_BoneColors>()?.base ?? Colors.black.withValues(alpha: 0.06);
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: color,
        shape: circle ? BoxShape.circle : BoxShape.rectangle,
        borderRadius: circle ? null : BorderRadius.circular(radius),
      ),
    );
  }
}

/// An outlined card like the app's cards, for skeleton content.
class BoneCard extends StatelessWidget {
  const BoneCard({super.key, required this.child, this.padding = const EdgeInsets.all(14), this.height});
  final Widget child;
  final EdgeInsets padding;
  final double? height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      padding: padding,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: child,
    );
  }
}

/// A list row: an icon or avatar, a title and a line or two of detail, and an optional trailing value.
class SkeletonTile extends StatelessWidget {
  const SkeletonTile({super.key, this.lines = 2, this.trailing = true, this.height});
  final int lines;
  final bool trailing;
  final double? height;

  @override
  Widget build(BuildContext context) {
    return BoneCard(
      height: height,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Bone.circle(40),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 3),
                const FractionallySizedBox(widthFactor: 0.62, child: Bone(height: 14)),
                for (var i = 1; i < lines; i++) ...[
                  const SizedBox(height: 8),
                  FractionallySizedBox(widthFactor: i == lines - 1 ? 0.4 : 0.9, child: const Bone(height: 10)),
                ],
              ],
            ),
          ),
          if (trailing) ...[
            const SizedBox(width: 12),
            const Padding(padding: EdgeInsets.only(top: 3), child: Bone(width: 48, height: 18, radius: 9)),
          ],
        ],
      ),
    );
  }
}

/// A list of [SkeletonTile]s: the loading state for lists of cards.
class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.count = 6, this.height, this.lines = 2, this.padding = const EdgeInsets.all(12), this.gap = 8});
  final int count;
  final double? height;
  final int lines;
  final EdgeInsets padding;
  final double gap;

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: ListView.separated(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        padding: padding,
        itemCount: count,
        separatorBuilder: (_, _) => SizedBox(height: gap),
        itemBuilder: (_, _) => SkeletonTile(lines: lines, height: height),
      ),
    );
  }
}

/// A summary screen: a large card with a headline figure, a row of small figures, then a list.
class SkeletonSummary extends StatelessWidget {
  const SkeletonSummary({super.key, this.rows = 4, this.padding = const EdgeInsets.all(12)});
  final int rows;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        padding: padding,
        children: [
          BoneCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Row(
                  children: [
                    Bone.circle(44),
                    SizedBox(width: 12),
                    Expanded(
                      child: FractionallySizedBox(alignment: Alignment.centerLeft, widthFactor: 0.5, child: Bone(height: 16)),
                    ),
                  ],
                ),
                SizedBox(height: 18),
                Bone(width: 140, height: 28, radius: 8),
                SizedBox(height: 10),
                FractionallySizedBox(widthFactor: 0.7, child: Bone(height: 10)),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              for (var i = 0; i < 3; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                const Expanded(
                  child: BoneCard(
                    padding: EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [Bone(width: 36, height: 18), SizedBox(height: 8), Bone(width: 56, height: 10)],
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 14),
          const Align(alignment: Alignment.centerLeft, child: Bone(width: 120, height: 14)),
          const SizedBox(height: 10),
          for (var i = 0; i < rows; i++) ...[if (i > 0) const SizedBox(height: 8), const SkeletonTile()],
        ],
      ),
    );
  }
}

/// A detail screen: a header card, then a card of label and value rows.
class SkeletonDetail extends StatelessWidget {
  const SkeletonDetail({super.key, this.rows = 6, this.padding = const EdgeInsets.all(16)});
  final int rows;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        padding: padding,
        children: [
          const BoneCard(
            padding: EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FractionallySizedBox(widthFactor: 0.55, child: Bone(height: 18)),
                SizedBox(height: 10),
                FractionallySizedBox(widthFactor: 0.35, child: Bone(height: 10)),
                SizedBox(height: 18),
                Bone(width: 120, height: 26, radius: 8),
              ],
            ),
          ),
          const SizedBox(height: 12),
          BoneCard(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Column(
              children: [
                for (var i = 0; i < rows; i++)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 10),
                    child: Row(children: [Bone(width: 90, height: 11), Spacer(), Bone(width: 70, height: 11)]),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A two-column grid of cards (classes to mark, dashboards).
class SkeletonGrid extends StatelessWidget {
  const SkeletonGrid({super.key, this.count = 6, this.height = 112, this.padding = const EdgeInsets.all(12)});
  final int count;
  final double height;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: GridView.builder(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        padding: padding,
        itemCount: count,
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, crossAxisSpacing: 10, mainAxisSpacing: 10, mainAxisExtent: height),
        itemBuilder: (_, _) => const BoneCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              FractionallySizedBox(widthFactor: 0.7, child: Bone(height: 14)),
              SizedBox(height: 8),
              FractionallySizedBox(widthFactor: 0.45, child: Bone(height: 10)),
              Spacer(),
              Bone(height: 6, radius: 3),
            ],
          ),
        ),
      ),
    );
  }
}
