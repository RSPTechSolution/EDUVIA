import 'dart:collection';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api/api_client.dart';

/// A list loaded a page at a time, that knows how many there are in all. It is a normal [List] of what's loaded,
/// so screens that just show the items don't need to know about paging.
class PagedList<T> extends ListBase<T> {
  PagedList(this._items, this.total);
  final List<T> _items;

  /// How many there are on the server.
  final int total;
  bool get hasMore => _items.length < total;

  @override
  int get length => _items.length;
  @override
  set length(int _) => throw UnsupportedError('PagedList is read-only');
  @override
  T operator [](int i) => _items[i];
  @override
  void operator []=(int i, T v) => throw UnsupportedError('PagedList is read-only');
}

/// How many pages of a list to show, by the list's name. "Load more" adds a page; pulling to refresh keeps them.
class PageCount extends Notifier<int> {
  PageCount(this.list);
  final String list;
  @override
  int build() => 1;
  void more() => state++;
}

final pagesProvider = NotifierProvider.autoDispose.family<PageCount, int, String>(PageCount.new);

const pageSize = 25;

/// Fetches the first [pages] pages of [path] and joins them.
Future<PagedList<T>> fetchPages<T>(ApiClient api, String path, int pages, T Function(Map<String, dynamic>) parse, {Map<String, dynamic>? query}) async {
  final results = await Future.wait([
    for (var p = 1; p <= pages; p++)
      api.get<List<T>>(
        path,
        query: {...?query, 'page': p, 'page_size': pageSize},
        parse: (d) => [for (final x in (d as List).cast<Map>()) parse(x.cast<String, dynamic>())],
      ),
  ]);
  final seen = <Object?>{};
  final items = <T>[];
  for (final r in results) {
    for (final x in r.data) {
      if (seen.add(x is Object ? _id(x) : x)) items.add(x);
    }
  }
  final total = (results.first.meta?['total'] as num?)?.toInt() ?? items.length;
  return PagedList(items, total);
}

Object? _id(Object x) {
  try {
    return (x as dynamic).id;
  } catch (_) {
    return x;
  }
}

/// "Showing 25 of 140 · Load more" at the end of a paged list.
class LoadMoreTile extends ConsumerStatefulWidget {
  const LoadMoreTile({super.key, required this.list, required this.items, this.noun = 'items'});
  final String list;
  final List<Object?> items;
  final String noun;

  @override
  ConsumerState<LoadMoreTile> createState() => _LoadMoreTileState();
}

class _LoadMoreTileState extends ConsumerState<LoadMoreTile> {
  int? _waitingFor;

  @override
  Widget build(BuildContext context) {
    final items = widget.items;
    if (items is! PagedList || items.total == 0) return const SizedBox.shrink();
    final loading = _waitingFor != null && items.length < _waitingFor!;
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      child: Column(
        children: [
          Text('Showing ${items.length} of ${items.total} ${widget.noun}', style: TextStyle(fontSize: 12, color: muted)),
          if (items.hasMore) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(minimumSize: const Size(160, 44)),
              onPressed: loading
                  ? null
                  : () {
                      setState(() => _waitingFor = items.length + 1);
                      ref.read(pagesProvider(widget.list).notifier).more();
                    },
              icon: loading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.expand_more_rounded),
              label: Text(loading ? 'Loading…' : 'Load more'),
            ),
          ],
        ],
      ),
    );
  }
}
