import 'package:eduvia/core/api/api_client.dart';
import 'package:eduvia/core/api/offline.dart';
import 'package:eduvia/core/auth/token_store.dart';
import 'package:eduvia/shared/paging.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fake_api.dart';

void main() {
  late FakeApi fake;
  late ApiClient api;

  setUp(() {
    fake = FakeApi();
    api = ApiClient(baseUrl: 'http://test', tokens: MemoryTokenStore()..access = 'a', adapter: fake, store: MemoryStore());
    offlineSince.value = null;
    pendingChanges.value = 0;
  });

  test('without a connection, a list shows the answer saved last time, with when it was saved', () async {
    fake.on(
      'GET /notices',
      (_) => (
        200,
        FakeApi.ok([
          {'id': 'n1'},
        ]),
      ),
    );
    await api.get<List<Object?>>('/notices', query: {'page': 1});
    await Future<void>.delayed(Duration.zero); // saving happens in the background

    fake.offline = true;
    final res = await api.get<List<Object?>>('/notices', query: {'page': 1});
    expect(res.data, [
      {'id': 'n1'},
    ]);
    expect(res.savedAt, isNotNull);
    expect(offlineSince.value, isNotNull);

    // Something never loaded before still fails, so the screen can say so.
    await expectLater(api.get<Object?>('/other'), throwsA(isA<ApiException>().having((e) => e.isNetwork, 'network', true)));

    // Back online: the offline note clears.
    fake.offline = false;
    await api.get<List<Object?>>('/notices', query: {'page': 1});
    expect(offlineSince.value, isNull);
  });

  test('changes made offline wait on the phone and are sent, newest version only, when back online', () async {
    final sent = <Object?>[];
    fake.on('PUT /attendance/sections/s1', (req) {
      sent.add(req.data);
      return (200, FakeApi.ok(null));
    });
    await api.sendLater('PUT', '/attendance/sections/s1', {'v': 1}, 'Attendance for 5 A');
    await api.sendLater('PUT', '/attendance/sections/s1', {'v': 2}, 'Attendance for 5 A');
    expect(pendingChanges.value, 1);

    fake.offline = true;
    expect(await api.flushPending(), 0);
    expect(pendingChanges.value, 1);

    fake.offline = false;
    expect(await api.flushPending(), 1);
    expect(sent, [
      {'v': 2},
    ]);
    expect(pendingChanges.value, 0);
  });

  test('signing out forgets saved answers', () async {
    fake.on('GET /auth/me', (_) => (200, FakeApi.ok({'id': 'u1'})));
    await api.get<Object?>('/auth/me');
    await Future<void>.delayed(Duration.zero);
    await api.clearSaved();
    fake.offline = true;
    await expectLater(api.get<Object?>('/auth/me'), throwsA(isA<ApiException>()));
  });

  test('load more joins pages and knows when there are no more', () async {
    fake.on('GET /notices', (req) {
      final page = req.queryParameters['page'] as int;
      return (
        200,
        {
          'success': true,
          'data': [
            for (var i = 0; i < (page == 1 ? 25 : 5); i++) {'id': 'p$page-$i'},
          ],
          'meta': {'total': 30, 'page': page, 'page_size': 25},
        },
      );
    });
    final one = await fetchPages(api, '/notices', 1, (j) => j['id']);
    expect((one.length, one.total, one.hasMore), (25, 30, true));
    final two = await fetchPages(api, '/notices', 2, (j) => j['id']);
    expect((two.length, two.hasMore), (30, false));
  });
}
