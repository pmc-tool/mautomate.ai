import "dart:async";

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../data/inbox_models.dart";
import "../data/inbox_repository.dart";

/// The views a merchant works in — mirrors the web `InboxView`.
///
/// "Needs you" is first and is the landing view on purpose: the AI answers
/// nearly everything, so the threads it handed back ARE the merchant's job list.
enum InboxView { needsYou, unassigned, mine, starred, open, closed, all }

extension InboxViewMeta on InboxView {
  String get label => switch (this) {
        InboxView.needsYou => "Needs you",
        InboxView.unassigned => "Unassigned",
        InboxView.mine => "Assigned to me",
        InboxView.starred => "Starred",
        InboxView.open => "All open",
        InboxView.closed => "Closed",
        InboxView.all => "Everything",
      };

  /// Only "Needs you" earns a loud badge — a non-zero count there is the queue.
  bool get urgent => this == InboxView.needsYou;

  int countOf(InboxCounts? counts) {
    if (counts == null) return 0;
    final v = counts.views;
    return switch (this) {
      InboxView.needsYou => v.needsYou,
      InboxView.unassigned => v.unassigned,
      InboxView.mine => v.mine,
      InboxView.starred => v.starred,
      InboxView.open => v.open,
      InboxView.closed => v.closed,
      InboxView.all => v.all,
    };
  }

  /// A view is a database query, not a client-side sieve — mirror the web
  /// `paramsForView` exactly.
  InboxListParams params({String? channel, bool unread = false, String? q}) {
    return switch (this) {
      InboxView.needsYou => InboxListParams(
          handlerMode: "queued",
          excludeClosed: true,
          channel: channel,
          unread: unread,
          q: q,
        ),
      InboxView.unassigned => InboxListParams(
          assigned: "none",
          excludeClosed: true,
          channel: channel,
          unread: unread,
          q: q,
        ),
      InboxView.mine => InboxListParams(
          assigned: "me",
          excludeClosed: true,
          channel: channel,
          unread: unread,
          q: q,
        ),
      InboxView.starred =>
        InboxListParams(starred: true, channel: channel, unread: unread, q: q),
      InboxView.open =>
        InboxListParams(status: "open", channel: channel, unread: unread, q: q),
      InboxView.closed =>
        InboxListParams(status: "closed", channel: channel, unread: unread, q: q),
      InboxView.all =>
        InboxListParams(channel: channel, unread: unread, q: q),
    };
  }
}

/// Immutable state for the inbox list.
class InboxListState {
  const InboxListState({
    this.conversations = const <InboxConversation>[],
    this.counts,
    this.view = InboxView.needsYou,
    this.channel = "",
    this.unreadOnly = false,
    this.query = "",
    this.isLoading = true,
    this.isRefreshing = false,
    this.error,
  });

  final List<InboxConversation> conversations;
  final InboxCounts? counts;
  final InboxView view;

  /// "" = all channels.
  final String channel;
  final bool unreadOnly;
  final String query;
  final bool isLoading;
  final bool isRefreshing;
  final ApiError? error;

  bool get isEmpty =>
      !isLoading && error == null && conversations.isEmpty;

  bool get hasFilters =>
      query.trim().isNotEmpty || unreadOnly || channel.isNotEmpty;

  static const Object _keep = Object();

  InboxListState copyWith({
    List<InboxConversation>? conversations,
    Object? counts = _keep,
    InboxView? view,
    String? channel,
    bool? unreadOnly,
    String? query,
    bool? isLoading,
    bool? isRefreshing,
    Object? error = _keep,
  }) {
    return InboxListState(
      conversations: conversations ?? this.conversations,
      counts: counts == _keep ? this.counts : counts as InboxCounts?,
      view: view ?? this.view,
      channel: channel ?? this.channel,
      unreadOnly: unreadOnly ?? this.unreadOnly,
      query: query ?? this.query,
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      error: error == _keep ? this.error : error as ApiError?,
    );
  }
}

/// How many rows a page requests. The list is server-filtered by the active
/// view; the client does not paginate further (parity with the web LIST_LIMIT).
const int kInboxListLimit = 100;

/// Loads the inbox list + badge counts and holds the active view/channel/search
/// filters. Search is debounced; every filter change re-queries the server
/// (a view is a query, never a client-side sieve). Badge counts fail silently —
/// a counts error must never take the inbox down.
class InboxListController extends Notifier<InboxListState> {
  Timer? _debounce;

  @override
  InboxListState build() {
    ref.onDispose(() => _debounce?.cancel());
    Future.microtask(() {
      _loadList();
      _loadCounts();
    });
    return const InboxListState();
  }

  InboxRepository get _repo => ref.read(inboxRepositoryProvider);

  Future<void> _loadList({bool refreshing = false}) async {
    state = state.copyWith(
      isLoading: refreshing ? state.isLoading : true,
      isRefreshing: refreshing,
      error: null,
    );
    try {
      final q = state.query.trim();
      final conversations = await _repo.listConversations(
        state.view.params(
          channel: state.channel.isEmpty ? null : state.channel,
          unread: state.unreadOnly,
          q: q.isEmpty ? null : q,
        ).copyWithLimit(kInboxListLimit),
      );
      state = state.copyWith(
        conversations: conversations,
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

  Future<void> _loadCounts() async {
    try {
      final counts = await _repo.getCounts();
      state = state.copyWith(counts: counts);
    } catch (_) {
      // Badges are a convenience; a failure must not take the inbox down.
    }
  }

  /// Pull-to-refresh — re-reads the list and the badge counts.
  Future<void> refresh() async {
    await Future.wait([_loadList(refreshing: true), _loadCounts()]);
  }

  /// Re-read after the list itself failed to load.
  void retry() {
    _loadList();
    _loadCounts();
  }

  /// Called after a thread action so the list + badges reflect the new state.
  void refreshSilently() {
    _loadList(refreshing: true);
    _loadCounts();
  }

  void setView(InboxView view) {
    if (view == state.view) return;
    state = state.copyWith(view: view);
    _loadList();
  }

  void setChannel(String channel) {
    if (channel == state.channel) return;
    state = state.copyWith(channel: channel);
    _loadList();
  }

  void setUnreadOnly(bool value) {
    if (value == state.unreadOnly) return;
    state = state.copyWith(unreadOnly: value);
    _loadList();
  }

  void search(String value) {
    state = state.copyWith(query: value);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _loadList);
  }
}

extension on InboxListParams {
  /// Returns a copy carrying [limit] — keeps the view's own filters intact.
  InboxListParams copyWithLimit(int limit) => InboxListParams(
        status: status,
        excludeClosed: excludeClosed,
        channel: channel,
        handlerMode: handlerMode,
        assigned: assigned,
        starred: starred,
        unread: unread,
        q: q,
        limit: limit,
        offset: offset,
      );
}

final inboxListControllerProvider =
    NotifierProvider<InboxListController, InboxListState>(
  InboxListController.new,
);
