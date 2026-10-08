import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_controller.dart';
import 'common.dart';

/// Opens an API file or PDF (e.g. `/fees/payments/<id>/receipt.pdf`) in the phone's viewer,
/// through a short-lived signed link.
Future<void> openApiFile(BuildContext context, WidgetRef ref, String path) async {
  try {
    final url = await ref.read(apiClientProvider).signedUrl(path);
    final ok = await launchUrl(url, mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) showSnack(context, 'No app on this phone can open the file', error: true);
  } on ApiException catch (e) {
    if (context.mounted) showSnack(context, e.message, error: true);
  }
}

/// A file attached to something (a homework worksheet...).
class AttachedFile {
  AttachedFile.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        filename = j['filename'] as String,
        contentType = j['content_type'] as String,
        size = (j['size'] as num).toInt();
  final String id;
  final String filename;
  final String contentType;
  final int size;

  IconData get icon => contentType.startsWith('image/')
      ? Icons.image_outlined
      : contentType == 'application/pdf'
          ? Icons.picture_as_pdf_outlined
          : Icons.insert_drive_file_outlined;
}

class AttachmentChips extends ConsumerWidget {
  const AttachmentChips({super.key, required this.files});
  final List<AttachedFile> files;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (files.isEmpty) return const SizedBox.shrink();
    return Wrap(spacing: 6, runSpacing: 6, children: [
      for (final f in files)
        ActionChip(
          avatar: Icon(f.icon, size: 16),
          label: Text(f.filename, overflow: TextOverflow.ellipsis),
          visualDensity: VisualDensity.compact,
          onPressed: () => openApiFile(context, ref, '/files/${f.id}'),
        ),
    ]);
  }
}
