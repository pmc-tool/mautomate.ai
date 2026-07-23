import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../data/marketing_models.dart";
import "../data/marketing_repository.dart";

/// A selectable post-status filter for the Posts tab (null = "All").
class PostStatusOption {
  const PostStatusOption(this.label, this.value);
  final String label;
  final String? value;
}

const List<PostStatusOption> kPostStatusOptions = [
  PostStatusOption("All", null),
  PostStatusOption("Draft", "draft"),
  PostStatusOption("Needs approval", "needs_approval"),
  PostStatusOption("Scheduled", "scheduled"),
  PostStatusOption("Published", "published"),
  PostStatusOption("Failed", "failed"),
];

/// State for the Posts tab: the loaded posts (hydrated with targets/media),
/// the active status filter, and load/refresh flags.
class MarketingPostsState {
  const MarketingPostsState({
    this.posts = const <MarketingPost>[],
    this.accounts = const <SocialAccount>[],
    this.isLoading = true,
    this.isRefreshing = false,
    this.error,
    this.status,
  });

  final List<MarketingPost> posts;

  /// Connected accounts, used by the composer to offer target platforms.
  final List<SocialAccount> accounts;
  final bool isLoading;
  final bool isRefreshing;
  final ApiError? error;
  final String? status;

  bool get isEmpty => !isLoading && error == null && posts.isEmpty;
  bool get hasFilter => status != null;

  /// The platforms the merchant has connected accounts for (status
  /// "connected"), which the composer can target.
  List<String> get connectedPlatforms {
    final seen = <String>{};
    for (final a in accounts) {
      if (a.status == "connected") seen.add(a.platform);
    }
    return seen.toList(growable: false);
  }

  static const Object _keep = Object();

  MarketingPostsState copyWith({
    List<MarketingPost>? posts,
    List<SocialAccount>? accounts,
    bool? isLoading,
    bool? isRefreshing,
    Object? error = _keep,
    Object? status = _keep,
  }) {
    return MarketingPostsState(
      posts: posts ?? this.posts,
      accounts: accounts ?? this.accounts,
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      error: error == _keep ? this.error : error as ApiError?,
      status: status == _keep ? this.status : status as String?,
    );
  }
}

/// Loads and mutates the marketing posts list. The list endpoint does not
/// hydrate targets/media, so each post's detail is fetched to show platforms +
/// schedule (mirrors the web posts page). Failures fall back to the list row.
class MarketingPostsController extends Notifier<MarketingPostsState> {
  @override
  MarketingPostsState build() {
    Future.microtask(_load);
    return const MarketingPostsState();
  }

  MarketingRepository get _repo => ref.read(marketingRepositoryProvider);

  Future<void> _load({bool refreshing = false}) async {
    state = state.copyWith(
      isLoading: refreshing ? state.isLoading : true,
      isRefreshing: refreshing,
      error: null,
    );
    try {
      final base = await _repo.listPosts(status: state.status);
      // Accounts are best-effort — a failure there must not fail the posts load.
      List<SocialAccount> accounts = state.accounts;
      try {
        accounts = (await _repo.listAccounts()).accounts;
      } catch (_) {
        // keep the prior accounts (or empty) — the composer degrades gracefully.
      }
      final hydrated = await Future.wait(
        base.map((p) async {
          try {
            return await _repo.getPost(p.id);
          } catch (_) {
            return p;
          }
        }),
      );
      state = state.copyWith(
        posts: hydrated,
        accounts: accounts,
        isLoading: false,
        isRefreshing: false,
        error: null,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        isRefreshing: false,
        error: ApiError.from(e),
      );
    }
  }

  Future<void> refresh() => _load(refreshing: true);

  void retry() => _load();

  void setStatus(String? status) {
    if (status == state.status) return;
    state = state.copyWith(status: status);
    _load();
  }

  /// Re-run the load after a mutation elsewhere (create/schedule/publish/delete).
  Future<void> reload() => _load(refreshing: true);
}

final marketingPostsControllerProvider =
    NotifierProvider<MarketingPostsController, MarketingPostsState>(
  MarketingPostsController.new,
);
