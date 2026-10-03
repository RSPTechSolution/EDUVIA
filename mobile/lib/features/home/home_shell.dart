import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/models.dart';
import '../../core/auth/session.dart';

/// Branch order in the router. The bar shows only the ones this user can use; everything else is under More.
enum Tab { home, attendance, homework, fees, more }

bool tabVisible(Tab tab, Me me) => switch (tab) {
      Tab.home || Tab.more => true,
      Tab.attendance => me.hasModule('attendance') && (me.isFamily || me.can('attendance.view')),
      Tab.homework => me.hasModule('academics') && (me.isFamily || me.can('homework.manage')),
      Tab.fees => me.hasModule('fees') && (me.isFamily || me.can('fees.view')),
    };

const _destinations = {
  Tab.home: NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Home'),
  Tab.attendance: NavigationDestination(icon: Icon(Icons.fact_check_outlined), selectedIcon: Icon(Icons.fact_check_rounded), label: 'Attendance'),
  Tab.homework: NavigationDestination(icon: Icon(Icons.menu_book_outlined), selectedIcon: Icon(Icons.menu_book_rounded), label: 'Homework'),
  Tab.fees: NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), selectedIcon: Icon(Icons.account_balance_wallet_rounded), label: 'Fees'),
  Tab.more: NavigationDestination(icon: Icon(Icons.grid_view_outlined), selectedIcon: Icon(Icons.grid_view_rounded), label: 'More'),
};

class HomeShell extends ConsumerWidget {
  const HomeShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider);
    final tabs = me == null ? [Tab.home, Tab.more] : Tab.values.where((t) => tabVisible(t, me)).toList();
    final current = Tab.values[shell.currentIndex];
    final selected = tabs.indexOf(current);
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected < 0 ? 0 : selected,
        onDestinationSelected: (i) {
          final branch = tabs[i].index;
          shell.goBranch(branch, initialLocation: branch == shell.currentIndex);
        },
        destinations: [for (final t in tabs) _destinations[t]!],
      ),
    );
  }
}
