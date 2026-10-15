import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Where the app keeps the last answer to each request, and changes waiting to be sent.
abstract class OfflineStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> remove(String key);
}

/// In memory: used in tests, and until the phone's storage is ready.
class MemoryStore implements OfflineStore {
  final _m = <String, String>{};
  @override
  Future<String?> read(String key) async => _m[key];
  @override
  Future<void> write(String key, String value) async => _m[key] = value;
  @override
  Future<void> remove(String key) async => _m.remove(key);
}

/// On the phone (and in the browser's storage on the web), so it survives closing the app.
/// If the storage isn't available (as in tests), it quietly keeps nothing.
class PrefsStore implements OfflineStore {
  // Created on each use, inside the try: without the platform plugin (tests) creating it throws.
  SharedPreferencesAsync get _prefs => SharedPreferencesAsync();
  @override
  Future<String?> read(String key) async {
    try {
      return await _prefs.getString('vnx.$key');
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> write(String key, String value) async {
    try {
      await _prefs.setString('vnx.$key', value);
    } catch (_) {}
  }

  @override
  Future<void> remove(String key) async {
    try {
      await _prefs.remove('vnx.$key');
    } catch (_) {}
  }
}

/// Whether the app is showing saved data because it can't reach the server, and from when.
/// The home screen shows a banner while this is set; it clears on the next request that gets through.
final offlineSince = ValueNotifier<DateTime?>(null);

/// How many changes are waiting on this phone to be sent.
final pendingChanges = ValueNotifier<int>(0);

/// A change made without a connection (such as a class's attendance), kept on the phone and sent later.
class PendingChange {
  PendingChange({required this.method, required this.path, required this.body, required this.label, DateTime? at}) : at = at ?? DateTime.now();
  final String method;
  final String path;
  final Object? body;
  final String label;
  final DateTime at;

  Map<String, Object?> toJson() => {'method': method, 'path': path, 'body': body, 'label': label, 'at': at.toIso8601String()};
  static PendingChange fromJson(Map<String, dynamic> j) => PendingChange(
    method: j['method'] as String,
    path: j['path'] as String,
    body: j['body'],
    label: j['label'] as String,
    at: DateTime.parse(j['at'] as String),
  );
}

/// The queue of [PendingChange]s. A newer change to the same thing (same path) replaces the older one.
class OfflineQueue {
  OfflineQueue(this.store);
  final OfflineStore store;
  static const _key = 'queue';

  Future<List<PendingChange>> all() async {
    final raw = await store.read(_key);
    if (raw == null) return [];
    try {
      return [for (final j in jsonDecode(raw) as List) PendingChange.fromJson((j as Map).cast<String, dynamic>())];
    } catch (_) {
      return [];
    }
  }

  Future<void> _save(List<PendingChange> list) async {
    pendingChanges.value = list.length;
    if (list.isEmpty) return store.remove(_key);
    await store.write(_key, jsonEncode([for (final c in list) c.toJson()]));
  }

  Future<void> add(PendingChange c) async {
    final list = (await all())..removeWhere((x) => x.path == c.path && x.method == c.method);
    await _save(list..add(c));
  }

  /// Drops every waiting change (on sign-out).
  Future<void> clear() => _save([]);

  /// Sends what's waiting, oldest first. Stops at the first one that can't get through, to keep the order.
  /// Returns how many were sent.
  Future<int> flush(Future<void> Function(PendingChange c) send) async {
    final list = await all();
    var sent = 0;
    while (list.isNotEmpty) {
      try {
        await send(list.first);
      } on Exception catch (e) {
        // Still offline: try again later. The server refused it: drop it rather than retry forever.
        if (e is OfflineError) break;
      }
      list.removeAt(0);
      sent++;
    }
    await _save(list);
    return sent;
  }
}

/// Thrown by a send that failed because there's no connection.
class OfflineError implements Exception {}
