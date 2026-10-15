import 'package:flutter/material.dart';

/// True when the person asked their device for less motion.
bool reduceMotion(BuildContext context) => MediaQuery.maybeDisableAnimationsOf(context) ?? false;

/// Fades and lifts a card in once, when it first appears. [index] staggers cards in a list.
class Entrance extends StatefulWidget {
  const Entrance({super.key, required this.child, this.index = 0, this.offset = 16});
  final Widget child;
  final int index;
  final double offset;

  @override
  State<Entrance> createState() => _EntranceState();
}

class _EntranceState extends State<Entrance> with SingleTickerProviderStateMixin {
  // The stagger is part of the animation (an interval), not a timer, so nothing is left pending if the card goes away.
  late final int _delay = 60 * widget.index.clamp(0, 6);
  late final AnimationController _c = AnimationController(vsync: this, duration: Duration(milliseconds: 420 + _delay));
  late final Animation<double> _t = CurvedAnimation(parent: _c, curve: Interval(_delay / (420 + _delay), 1, curve: Curves.easeOutCubic));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_c.isAnimating || _c.isCompleted) return;
    if (reduceMotion(context)) {
      _c.value = 1;
    } else {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _t,
        child: widget.child,
        builder: (_, child) => Opacity(
          opacity: _t.value,
          child: Transform.translate(offset: Offset(0, widget.offset * (1 - _t.value)), child: child),
        ),
      );
}

/// Shrinks its child slightly while it is pressed, so a tap feels physical. Taps still reach the child.
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.scale = 0.97});
  final Widget child;
  final double scale;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) => Listener(
        onPointerDown: (_) => _set(true),
        onPointerUp: (_) => _set(false),
        onPointerCancel: (_) => _set(false),
        child: AnimatedScale(
          scale: _down && !reduceMotion(context) ? widget.scale : 1,
          duration: const Duration(milliseconds: 120),
          curve: Curves.easeOut,
          child: widget.child,
        ),
      );
}

/// Smooth, springy scrolling everywhere: the list glides past its ends and settles back, as on iOS.
class AppScrollBehavior extends MaterialScrollBehavior {
  const AppScrollBehavior();

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) => const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics());
}
