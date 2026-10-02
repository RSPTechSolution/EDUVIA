import 'dart:async';
// import 'package:geolocator/geolocator.dart';
// import 'package:background_fetch/background_fetch.dart';
// import 'package:sqflite/sqflite.dart';

class GpsService {
  static const _taskId = 'driver-gps-task';
  // static Database? _db;

  static Future<void> init() async {
    /*
    _db = await openDatabase('gps_queue.db', version: 1, onCreate: (db, _) {
      db.execute('''CREATE TABLE gps_queue(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id TEXT, lat REAL, lng REAL, speed REAL, logged_at TEXT, synced INTEGER DEFAULT 0
      )''');
    });
    */
  }

  static Future<void> startTracking(String tripId) async {
    /*
    await BackgroundFetch.configure(
      BackgroundFetchConfig(minimumFetchInterval: 1, stopOnTerminate: false, enableHeadless: true),
      (taskId) async {
        await _captureAndQueue(tripId);
        BackgroundFetch.finish(taskId);
      },
    );
    await BackgroundFetch.start();
    */
  }

  static Future<void> _captureAndQueue(String tripId) async {
    /*
    final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
    await _db!.insert('gps_queue', {
      'trip_id': tripId, 'lat': pos.latitude, 'lng': pos.longitude,
      'speed': pos.speed, 'logged_at': DateTime.now().toIso8601String(), 'synced': 0,
    });
    await _syncQueue(tripId);
    */
  }

  static Future<void> _syncQueue(String tripId) async {
    /*
    final rows = await _db!.query('gps_queue', where: 'synced = 0 AND trip_id = ?', whereArgs: [tripId]);
    if (rows.isEmpty) return;
    try {
      final api = GetIt.I<ApiClient>();
      await api.post('/api/v1/transport/trips/$tripId/gps', data: {
        'pings': rows.map((r) => {'lat': r['lat'], 'lng': r['lng'], 'speed': r['speed']}).toList(),
      });
      final ids = rows.map((r) => r['id']).join(',');
      await _db!.rawUpdate('UPDATE gps_queue SET synced = 1 WHERE id IN ($ids)');
    } catch (_) {
      // Network down — leave in queue, retry next cycle
    }
    */
  }

  static Future<void> stopTracking() async {
    // BackgroundFetch.stop();
  }
}
