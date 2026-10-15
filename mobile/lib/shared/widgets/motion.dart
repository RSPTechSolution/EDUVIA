import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';

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
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: Duration(milliseconds: 420 + _delay),
  );
  late final Animation<double> _t = CurvedAnimation(
    parent: _c,
    curve: Interval(_delay / (420 + _delay), 1, curve: Curves.easeOutCubic),
  );

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

/// Swipe a row sideways to act on it (e.g. mark a notice read), Gmail-style: a coloured strip with the action shows
/// under the finger, the action runs, and the row springs back in place. Screen readers get the same action as a
/// custom semantics action, so nothing depends on swiping.
class SwipeAction extends StatelessWidget {
  const SwipeAction({super.key, required this.child, required this.label, required this.icon, required this.onSwipe, this.enabled = true, required this.id});
  final Widget child;
  final String label;
  final IconData icon;
  final VoidCallback onSwipe;
  final bool enabled;
  final Object id;

  @override
  Widget build(BuildContext context) {
    if (!enabled) return child;
    final scheme = Theme.of(context).colorScheme;
    Widget strip(Alignment a) => Container(
      alignment: a,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: BoxDecoration(color: scheme.primaryContainer, borderRadius: BorderRadius.circular(16)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: scheme.onPrimaryContainer),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(color: scheme.onPrimaryContainer, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
    return Semantics(
      customSemanticsActions: {CustomSemanticsAction(label: label): onSwipe},
      child: Dismissible(
        key: ValueKey(id),
        background: strip(Alignment.centerLeft),
        secondaryBackground: strip(Alignment.centerRight),
        dismissThresholds: const {DismissDirection.startToEnd: 0.3, DismissDirection.endToStart: 0.3},
        // Act, then spring back: the row stays in the list with its new state.
        confirmDismiss: (_) async {
          HapticFeedback.lightImpact();
          onSwipe();
          return false;
        },
        child: child,
      ),
    );
  }
}
