import "package:flutter/widgets.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/theme/app_colors.dart";
import "../../../core/widgets/status_chip.dart";
import "../data/inbox_models.dart";

/// Channel presentation — icon + label + a theme-token colour. Ported from the
/// web `CHANNELS`/`channelMeta`, but colours resolve to design-system tokens
/// (never a hardcoded hex).
class InboxChannelMeta {
  const InboxChannelMeta(this.id, this.label, this.icon, this._color);

  final String id;
  final String label;
  final IconData icon;
  final Color Function(AppColors) _color;

  Color color(AppColors c) => _color(c);
}

/// Every channel the backend's marketing_conversation enum can carry.
final List<InboxChannelMeta> kInboxChannels = [
  InboxChannelMeta("web_widget", "Website", PhosphorIcons.globe(), (c) => c.info),
  InboxChannelMeta("whatsapp", "WhatsApp", PhosphorIcons.whatsappLogo(), (c) => c.success),
  InboxChannelMeta("messenger", "Messenger", PhosphorIcons.messengerLogo(), (c) => c.info),
  InboxChannelMeta("instagram", "Instagram", PhosphorIcons.instagramLogo(), (c) => c.accent),
  InboxChannelMeta("telegram", "Telegram", PhosphorIcons.telegramLogo(), (c) => c.cyan),
  InboxChannelMeta("email", "Email", PhosphorIcons.envelope(), (c) => c.textSecondary),
  InboxChannelMeta("review", "Reviews", PhosphorIcons.star(), (c) => c.warning),
  InboxChannelMeta("voice", "Calls", PhosphorIcons.phone(), (c) => c.primary),
];

final InboxChannelMeta _unknownChannel = InboxChannelMeta(
  "unknown",
  "Unknown",
  PhosphorIcons.chatCircle(),
  (c) => c.textMuted,
);

InboxChannelMeta channelMeta(String? channel) {
  for (final c in kInboxChannels) {
    if (c.id == channel) return c;
  }
  return _unknownChannel;
}

/// Who currently owns a thread. [tone] drives the badge colour; [label] is the
/// merchant-facing name. Mirrors the web `HANDLER_MODES`.
class InboxHandlerMeta {
  const InboxHandlerMeta(this.label, this.icon, this.tone);
  final String label;
  final IconData icon;
  final StatusTone tone;
}

InboxHandlerMeta handlerMeta(String? mode) {
  switch (mode) {
    case "queued":
      return InboxHandlerMeta("Waiting for agent", PhosphorIcons.clock(), StatusTone.pending);
    case "human":
      return InboxHandlerMeta("Agent handling", PhosphorIcons.user(), StatusTone.success);
    case "ai":
    default:
      return InboxHandlerMeta("AI handling", PhosphorIcons.robot(), StatusTone.info);
  }
}

/// Why the AI stepped back, in words a shop owner can act on. [actionRoute] is
/// set when the merchant must do something outside this thread (e.g. top up
/// credits). Ported 1:1 from the web `handoffCopy`.
class InboxHandoffCopy {
  const InboxHandoffCopy({
    required this.title,
    required this.detail,
    this.actionLabel,
    this.actionRoute,
    this.selfHealing = false,
  });

  final String title;
  final String detail;
  final String? actionLabel;
  final String? actionRoute;
  final bool selfHealing;
}

InboxHandoffCopy? handoffCopy(String? reason) {
  switch (reason) {
    case "requested_human":
      return const InboxHandoffCopy(
        title: "The customer asked for a person",
        detail:
            "They said something like \"talk to a human\", so the assistant stopped and handed the thread to you. Take it over and reply.",
      );
    case "out_of_credits":
      return const InboxHandoffCopy(
        title: "Your store ran out of AI credits",
        detail:
            "The assistant stops replying at zero. Top up and it starts answering again on the next message — you do not have to re-enable anything.",
        actionLabel: "Top up credits",
        actionRoute: "/billing",
      );
    case "ai_unavailable":
      return const InboxHandoffCopy(
        title: "The AI could not be reached",
        detail:
            "A temporary problem with the AI provider. The assistant takes this thread back by itself as soon as the next message arrives — reply yourself if the customer is waiting.",
        selfHealing: true,
      );
    case "ai_message_limit":
      return const InboxHandoffCopy(
        title: "The assistant hit its reply limit for this thread",
        detail:
            "It had already answered several times here, so it stopped rather than talk in circles. This one needs a human.",
      );
    case "daily_cap":
      return const InboxHandoffCopy(
        title: "Your store hit its daily automatic-reply limit",
        detail:
            "A safety limit on how many replies the assistant sends in one day. It resets at midnight UTC.",
      );
    default:
      if (reason != null && reason.isNotEmpty) {
        return InboxHandoffCopy(
          title: "The assistant handed this thread over",
          detail: reason,
        );
      }
      return null;
  }
}

String contactName(InboxContact? contact) {
  if (contact == null) return "Unknown contact";
  final name = contact.displayName?.trim();
  if (name != null && name.isNotEmpty) return name;
  final email = contact.email?.trim();
  if (email != null && email.isNotEmpty) return email;
  final phone = contact.phone?.trim();
  if (phone != null && phone.isNotEmpty) return phone;
  return "Unknown contact";
}

String initial(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) return "?";
  return trimmed[0].toUpperCase();
}

/// "now" / "5m" / "3h" / "2d" / "Jul 14" — mirrors the web `timeAgo`.
String timeAgo(String? iso) {
  if (iso == null || iso.isEmpty) return "";
  final date = DateTime.tryParse(iso);
  if (date == null) return "";
  final mins = DateTime.now().difference(date.toLocal()).inMinutes;
  if (mins < 1) return "now";
  if (mins < 60) return "${mins}m";
  final hours = mins ~/ 60;
  if (hours < 24) return "${hours}h";
  final days = hours ~/ 24;
  if (days < 7) return "${days}d";
  return _shortDate(date.toLocal());
}

String _shortDate(DateTime d) {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return "${months[d.month - 1]} ${d.day}";
}

/// "14:05" style clock — mirrors the web `messageTime`.
String messageTime(String? iso) {
  if (iso == null || iso.isEmpty) return "";
  final date = DateTime.tryParse(iso);
  if (date == null) return "";
  final local = date.toLocal();
  final h = local.hour.toString().padLeft(2, "0");
  final m = local.minute.toString().padLeft(2, "0");
  return "$h:$m";
}

/// Today / Yesterday / "Monday, Jul 14" — mirrors the web `dayLabel`.
String dayLabel(String? iso) {
  if (iso == null || iso.isEmpty) return "Earlier";
  final date = DateTime.tryParse(iso);
  if (date == null) return "Earlier";
  final local = date.toLocal();
  final today = DateTime.now();
  final yesterday = today.subtract(const Duration(days: 1));
  if (_sameDay(local, today)) return "Today";
  if (_sameDay(local, yesterday)) return "Yesterday";
  const weekdays = [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  ];
  return "${weekdays[local.weekday - 1]}, ${_shortDate(local)}";
}

String dayKey(String? iso) {
  if (iso == null || iso.isEmpty) return "unknown";
  final date = DateTime.tryParse(iso);
  if (date == null) return "unknown";
  final l = date.toLocal();
  return "${l.year}-${l.month}-${l.day}";
}

bool _sameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

/// An "internal" delivery_status marks a system/audit line the backend writes on
/// take-over, assignment and status changes — never delivered to a contact.
bool isInternalMessage(InboxMessage m) =>
    m.deliveryStatus == "internal" || m.author == "system";
