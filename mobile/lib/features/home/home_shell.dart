import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/models.dart';
import '../../core/auth/session.dart';

/// Branch order in the router. The bar shows only the ones this user can use.
enum Tab { home, attendance, fees, timetable, profile }

bool tabVisible(Tab tab, Me me) => switch (tab) {
      Tab.home || Tab.profile => true,
      Tab.attendance => me.hasModule('attendance') && (me.isFamily || me.can('attendance.view')),
      Tab.fees => me.hasModule('fees') && (me.isFamily || me.can('fees.view')),
      Tab.timetable => me.hasModule('academics') && (me.isFamily || me.teaches),
    };

const _destinations = {
  Tab.home: NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Home'),
  Tab.attendance: NavigationDestination(icon: Icon(Icons.fact_check_outlined), selectedIcon: Icon(Icons.fact_check_rounded), label: 'Attendance'),
  Tab.fees: NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), selectedIcon: Icon(Icons.account_balance_wallet_rounded), label: 'Fees'),
  Tab.timetable: NavigationDestination(icon: Icon(Icons.calendar_month_outlined), selectedIcon: Icon(Icons.calendar_month_rounded), label: 'Timetable'),
  Tab.profile: NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person_rounded), label: 'Profile'),
};

class HomeShell extends ConsumerWidget {
  const HomeShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider);
    final tabs = me == null ? [Tab.home, Tab.profile] : Tab.values.where((t) => tabVisible(t, me)).toList();
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
