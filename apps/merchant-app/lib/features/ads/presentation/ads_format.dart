import "package:intl/intl.dart";

/// Shared display helpers for the Advertising screens.

/// A grouped integer ("1,204").
String fmtInt(num v) =>
    NumberFormat.decimalPattern().format(v.round());

/// ROAS as a multiplier ("2.40x") or an em-dash when unavailable.
String fmtRoas(num? roas) => roas == null ? "—" : "${roas.toStringAsFixed(2)}x";

/// Humanises a campaign objective ("OUTCOME_SALES" -> "sales").
String fmtObjective(String? objective) {
  if (objective == null || objective.isEmpty) return "";
  return objective.replaceFirst(RegExp(r"^OUTCOME_"), "").toLowerCase();
}

/// A short "synced N ago" label from an ISO timestamp, or null.
String? syncedAgo(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  final dt = DateTime.tryParse(iso);
  if (dt == null) return null;
  final mins = DateTime.now().difference(dt.toLocal()).inMinutes;
  if (mins < 1) return "just now";
  if (mins < 60) return "$mins min ago";
  final hours = (mins / 60).round();
  if (hours < 48) return "$hours h ago";
  return "${(hours / 24).round()} d ago";
}

/// A short, locale-aware date ("Jul 18, 2026") from an ISO string.
String fmtDate(String iso) {
  if (iso.isEmpty) return "";
  final dt = DateTime.tryParse(iso);
  if (dt == null) return "";
  return DateFormat.yMMMd().format(dt.toLocal());
}

/// A date + time ("Jul 18, 2026, 3:04 PM") from an ISO string.
String fmtDateTime(String iso) {
  if (iso.isEmpty) return "";
  final dt = DateTime.tryParse(iso);
  if (dt == null) return "";
  return DateFormat.yMMMd().add_jm().format(dt.toLocal());
}

/// Humanises a snake/OUTCOME token ("pause_campaign" -> "Pause campaign").
String humanise(String value) {
  final cleaned = value.replaceAll("_", " ").trim();
  if (cleaned.isEmpty) return "";
  return cleaned[0].toUpperCase() + cleaned.substring(1);
}
