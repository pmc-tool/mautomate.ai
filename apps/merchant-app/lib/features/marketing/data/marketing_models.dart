// DTOs for the merchant Marketing feature, mirroring the web client's
// `MarketingSummary`, `MarketingPost`, `MarketingPostTarget`,
// `MarketingPostMedia`, `SocialAccount`, `SocialProvider` and
// `MarketingCampaign` (apps/storefront/src/lib/merchant-admin/api.ts).
// freezed + json_serializable generate parsing, equality and copyWith. Field
// names are snake_case on the wire, camelCase in Dart via @JsonKey.
//
// Run codegen after editing:
//   dart run build_runner build --delete-conflicting-outputs
//
// `invalid_annotation_target` is suppressed because @JsonKey on a freezed
// factory parameter is the documented, generator-supported pattern (same
// convention as the Orders + Products DTOs).
// ignore_for_file: invalid_annotation_target
import "package:freezed_annotation/freezed_annotation.dart";

part "marketing_models.freezed.dart";
part "marketing_models.g.dart";

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/// The post roll-up inside the marketing summary — total + a per-status count
/// map. Mirrors the web `MarketingSummary.posts`.
@freezed
class MarketingPostsSummary with _$MarketingPostsSummary {
  const factory MarketingPostsSummary({
    @Default(0) int total,
    @JsonKey(name: "by_status")
    @Default(<String, int>{})
    Map<String, int> byStatus,
  }) = _MarketingPostsSummary;

  factory MarketingPostsSummary.fromJson(Map<String, dynamic> json) =>
      _$MarketingPostsSummaryFromJson(json);
}

/// GET /merchant/marketing -> the marketing overview counts. Mirrors the web
/// `MarketingSummary`.
@freezed
class MarketingSummary with _$MarketingSummary {
  const factory MarketingSummary({
    MarketingPostsSummary? posts,
    @JsonKey(name: "scheduled_next_7d") @Default(0) int scheduledNext7d,
    @JsonKey(name: "brand_voice_count") @Default(0) int brandVoiceCount,
    @JsonKey(name: "connected_accounts_count")
    @Default(0)
    int connectedAccountsCount,
    @JsonKey(name: "recent_conversations_count")
    @Default(0)
    int recentConversationsCount,
  }) = _MarketingSummary;

  factory MarketingSummary.fromJson(Map<String, dynamic> json) =>
      _$MarketingSummaryFromJson(json);
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

/// A per-platform delivery of a post — mirrors `marketing_post_target`.
@freezed
class MarketingPostTarget with _$MarketingPostTarget {
  const factory MarketingPostTarget({
    @Default("") String id,
    @Default("") String platform,
    @JsonKey(name: "social_account_id") String? socialAccountId,
    @Default("pending") String status,
    @JsonKey(name: "override_body") String? overrideBody,
    @JsonKey(name: "override_hashtags") List<String>? overrideHashtags,
    @JsonKey(name: "scheduled_at") String? scheduledAt,
    @JsonKey(name: "published_at") String? publishedAt,
    @JsonKey(name: "external_url") String? externalUrl,
    String? error,
  }) = _MarketingPostTarget;

  factory MarketingPostTarget.fromJson(Map<String, dynamic> json) =>
      _$MarketingPostTargetFromJson(json);
}

/// Media attached to a post — mirrors `marketing_post_media`.
@freezed
class MarketingPostMedia with _$MarketingPostMedia {
  const factory MarketingPostMedia({
    @Default("") String id,
    @Default("image") String kind,
    String? url,
    String? alt,
    @Default(0) int position,
  }) = _MarketingPostMedia;

  factory MarketingPostMedia.fromJson(Map<String, dynamic> json) =>
      _$MarketingPostMediaFromJson(json);
}

/// A marketing post. The list endpoint does NOT hydrate [targets]/[media];
/// GET /merchant/marketing/posts/:id does. Mirrors the web `MarketingPost`.
@freezed
class MarketingPost with _$MarketingPost {
  const factory MarketingPost({
    @Default("") String id,
    @Default("draft") String status,
    String? title,
    String? body,
    @Default("manual") String source,
    List<String>? hashtags,
    @JsonKey(name: "link_url") String? linkUrl,
    @JsonKey(name: "campaign_id") String? campaignId,
    @JsonKey(name: "created_at") @Default("") String createdAt,
    @JsonKey(name: "updated_at") @Default("") String updatedAt,
    List<MarketingPostTarget>? targets,
    List<MarketingPostMedia>? media,
  }) = _MarketingPost;

  factory MarketingPost.fromJson(Map<String, dynamic> json) =>
      _$MarketingPostFromJson(json);
}

// ---------------------------------------------------------------------------
// Social accounts / providers (channels)
// ---------------------------------------------------------------------------

/// A connected social account — mirrors the web `SocialAccount`.
@freezed
class SocialAccount with _$SocialAccount {
  const factory SocialAccount({
    @Default("") String id,
    @Default("") String platform,
    String? handle,
    @JsonKey(name: "display_name") String? displayName,
    @JsonKey(name: "avatar_url") String? avatarUrl,
    @Default("connected") String status,
    @JsonKey(name: "connected_at") String? connectedAt,
  }) = _SocialAccount;

  factory SocialAccount.fromJson(Map<String, dynamic> json) =>
      _$SocialAccountFromJson(json);
}

/// A provider catalog entry from GET /merchant/marketing/accounts. `configured`
/// reflects operator app-level credentials; `connect` is the mechanism.
@freezed
class SocialProvider with _$SocialProvider {
  const factory SocialProvider({
    @Default("") String platform,
    @Default("") String label,
    @Default(false) bool configured,
    @Default("oauth") String connect,
    @Default(false) bool connected,
  }) = _SocialProvider;

  factory SocialProvider.fromJson(Map<String, dynamic> json) =>
      _$SocialProviderFromJson(json);
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

/// A marketing campaign — mirrors the web `MarketingCampaign`.
@freezed
class MarketingCampaign with _$MarketingCampaign {
  const factory MarketingCampaign({
    @Default("") String id,
    @Default("") String name,
    String? objective,
    @Default("draft") String status,
    @JsonKey(name: "starts_at") String? startsAt,
    @JsonKey(name: "ends_at") String? endsAt,
    @JsonKey(name: "product_ids") List<String>? productIds,
    @JsonKey(name: "created_at") @Default("") String createdAt,
    @JsonKey(name: "updated_at") @Default("") String updatedAt,
  }) = _MarketingCampaign;

  factory MarketingCampaign.fromJson(Map<String, dynamic> json) =>
      _$MarketingCampaignFromJson(json);
}

// ---------------------------------------------------------------------------
// Non-serialised results
// ---------------------------------------------------------------------------

/// The outcome of POST /merchant/marketing/posts/:id/publish-now. The backend
/// is honestly gated: when publishing is disabled server-side it responds with
/// [publishingDisabled] true and a [note] rather than faking a publish.
class PublishResult {
  const PublishResult({
    required this.published,
    this.publishingDisabled = false,
    this.note,
  });

  final bool published;
  final bool publishingDisabled;
  final String? note;

  factory PublishResult.fromJson(Map<String, dynamic> json) => PublishResult(
        published: json["published"] == true,
        publishingDisabled: json["publishing_disabled"] == true,
        note: json["note"] as String?,
      );

  /// A merchant-facing summary of what the publish sweep did.
  String get message {
    if (publishingDisabled) {
      return note ?? "Publishing is currently disabled on the server.";
    }
    if (published) return "Post published.";
    return "Publish sweep ran — check target statuses for results.";
  }
}

/// The connected accounts + provider catalog from GET
/// /merchant/marketing/accounts.
class SocialAccountsResult {
  const SocialAccountsResult({required this.accounts, required this.providers});

  final List<SocialAccount> accounts;
  final List<SocialProvider> providers;
}

/// Helpers shared across the presentation layer.
extension MarketingPostX on MarketingPost {
  /// Unique platforms targeted by this post, in target order.
  List<String> get platforms {
    final seen = <String>{};
    final out = <String>[];
    for (final t in targets ?? const <MarketingPostTarget>[]) {
      if (t.platform.isNotEmpty && seen.add(t.platform)) out.add(t.platform);
    }
    return out;
  }

  /// The earliest scheduled_at across targets (ISO string) or null.
  String? get earliestScheduledAt {
    final times = (targets ?? const <MarketingPostTarget>[])
        .map((t) => t.scheduledAt)
        .whereType<String>()
        .toList()
      ..sort();
    return times.isEmpty ? null : times.first;
  }

  /// A short display label: title, else first line of body, else a fallback.
  String get label {
    final t = title?.trim();
    if (t != null && t.isNotEmpty) return t;
    final b = body?.trim();
    if (b != null && b.isNotEmpty) return b;
    return "Untitled post";
  }
}
