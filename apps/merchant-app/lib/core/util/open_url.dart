import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:url_launcher/url_launcher.dart";

/// Open [url] in the device's native browser (external application), with a
/// graceful degrade: if the URL can't be parsed or the platform can't launch
/// it, the link is copied to the clipboard and a snackbar tells the merchant to
/// paste it into a browser. Callers keep any confirm gate in front of this — it
/// only performs the open.
///
/// iOS note: launching a plain `https`/`http` URL needs NO
/// `LSApplicationQueriesSchemes` entry in Info.plist (that allowlist is only for
/// `canLaunchUrl` on custom/non-web schemes). If a future caller needs to probe
/// a custom scheme, add it there — the basic web open used here does not.
Future<void> openExternalUrl(BuildContext context, String url) async {
  final messenger = ScaffoldMessenger.of(context);

  Future<void> fallbackCopy(String message) async {
    await Clipboard.setData(ClipboardData(text: url));
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  final uri = Uri.tryParse(url);
  if (uri == null || url.trim().isEmpty) {
    await fallbackCopy("Couldn't open the link — copied it to your clipboard.");
    return;
  }

  try {
    final launched = await launchUrl(
      uri,
      mode: LaunchMode.externalApplication,
    );
    if (!launched) {
      await fallbackCopy(
        "Couldn't open the link — copied it to your clipboard.",
      );
    }
  } catch (_) {
    await fallbackCopy("Couldn't open the link — copied it to your clipboard.");
  }
}
