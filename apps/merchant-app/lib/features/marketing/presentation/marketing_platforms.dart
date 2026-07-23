import "package:flutter/widgets.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

/// Display metadata for a social platform: a human label and a consistent
/// Phosphor glyph. Platforms without a dedicated brand glyph fall back to a
/// neutral share icon, mirroring the web `platformMeta`.
class PlatformMeta {
  const PlatformMeta(this.value, this.label, this.icon);
  final String value;
  final String label;
  final IconData icon;
}

final Map<String, PlatformMeta> _kPlatforms = {
  "facebook": PlatformMeta("facebook", "Facebook", PhosphorIcons.facebookLogo()),
  "instagram":
      PlatformMeta("instagram", "Instagram", PhosphorIcons.instagramLogo()),
  "twitter": PlatformMeta("twitter", "X (Twitter)", PhosphorIcons.xLogo()),
  "x": PlatformMeta("x", "X (Twitter)", PhosphorIcons.xLogo()),
  "linkedin":
      PlatformMeta("linkedin", "LinkedIn", PhosphorIcons.linkedinLogo()),
  "telegram":
      PlatformMeta("telegram", "Telegram", PhosphorIcons.telegramLogo()),
  "whatsapp":
      PlatformMeta("whatsapp", "WhatsApp", PhosphorIcons.whatsappLogo()),
  "tiktok": PlatformMeta("tiktok", "TikTok", PhosphorIcons.tiktokLogo()),
  "youtube": PlatformMeta("youtube", "YouTube", PhosphorIcons.youtubeLogo()),
  "pinterest":
      PlatformMeta("pinterest", "Pinterest", PhosphorIcons.pinterestLogo()),
};

/// The platforms the composer can target (ordered for the picker).
const List<String> kComposablePlatforms = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "telegram",
];

/// Resolve a platform key to its display metadata, with a neutral fallback for
/// unknown platforms.
PlatformMeta platformMeta(String platform) {
  final meta = _kPlatforms[platform.toLowerCase()];
  if (meta != null) return meta;
  final label =
      platform.isEmpty ? "Channel" : platform[0].toUpperCase() + platform.substring(1);
  return PlatformMeta(platform, label, PhosphorIcons.shareNetwork());
}
