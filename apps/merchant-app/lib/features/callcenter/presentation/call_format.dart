import "package:intl/intl.dart";

import "../../../core/widgets/widgets.dart";

/// Shared formatting for the Call Center surfaces — kept in one place so a
/// call's time, duration and sentiment read identically across the log,
/// the detail and the overview.

/// A short, relative timestamp: "Today, 14:32", "Yesterday, 09:05", or
/// "Jul 12, 14:32" (with a year when it isn't the current one). Mirrors the
/// web `formatWhen`.
String formatCallWhen(String? iso) {
  if (iso == null || iso.isEmpty) return "—";
  final dt = DateTime.tryParse(iso);
  if (dt == null) return "—";
  final local = dt.toLocal();
  final now = DateTime.now();
  final time = DateFormat.Hm().format(local);
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(local.year, local.month, local.day);
  final diff = today.difference(day).inDays;
  if (diff == 0) return "Today, $time";
  if (diff == 1) return "Yesterday, $time";
  final datePart = local.year == now.year
      ? DateFormat.MMMd().format(local)
      : DateFormat.yMMMd().format(local);
  return "$datePart, $time";
}

/// A "m:ss" duration between two ISO timestamps, or "—" when either is
/// missing. Mirrors the web `formatDuration`.
String formatCallDuration(String? start, String? end) {
  if (start == null || end == null) return "—";
  final s = DateTime.tryParse(start);
  final e = DateTime.tryParse(end);
  if (s == null || e == null) return "—";
  final secs = e.difference(s).inSeconds;
  if (secs < 0) return "—";
  final m = secs ~/ 60;
  final rem = secs % 60;
  return "$m:${rem.toString().padLeft(2, "0")}";
}

/// Maps a free-text sentiment label to a chip tone, mirroring the web
/// `SentimentPill` keyword buckets.
StatusTone sentimentTone(String? sentiment) {
  if (sentiment == null || sentiment.trim().isEmpty) return StatusTone.neutral;
  final v = sentiment.toLowerCase();
  const positive = ["positive", "happy", "satisfied", "good"];
  const negative = ["negative", "angry", "frustrated", "bad", "upset"];
  if (positive.any(v.contains)) return StatusTone.success;
  if (negative.any(v.contains)) return StatusTone.error;
  return StatusTone.neutral;
}

/// Humanises a snake_case token for display ("no_answer" -> "No answer").
String humaniseToken(String value) {
  final cleaned = value.replaceAll("_", " ").trim();
  if (cleaned.isEmpty) return "—";
  return cleaned[0].toUpperCase() + cleaned.substring(1);
}
