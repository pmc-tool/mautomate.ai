import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../data/domain_models.dart";
import "../data/domains_repository.dart";

/// Immutable state for the domains list on the main screen.
///
/// [loading] drives the first-load skeleton; [refreshing] is the pull-to-refresh
/// pass (rows stay on screen); [error] is only set on a fresh-load failure so the
/// whole surface shows the retry state.
class DomainsListState {
  const DomainsListState({
    this.domains = const [],
    this.loading = true,
    this.refreshing = false,
    this.error,
  });

  final List<Domain> domains;
  final bool loading;
  final bool refreshing;
  final ApiError? error;

  bool get isEmpty => !loading && error == null && domains.isEmpty;

  DomainsListState copyWith({
    List<Domain>? domains,
    bool? loading,
    bool? refreshing,
    Object? error = _keep,
  }) {
    return DomainsListState(
      domains: domains ?? this.domains,
      loading: loading ?? this.loading,
      refreshing: refreshing ?? this.refreshing,
      error: error == _keep ? this.error : error as ApiError?,
    );
  }

  static const Object _keep = Object();
}

/// Loads the store's domains and exposes reload after a connect/verify/remove.
class DomainsListController extends Notifier<DomainsListState> {
  DomainsRepository get _repo => ref.read(domainsRepositoryProvider);

  @override
  DomainsListState build() {
    Future.microtask(_load);
    return const DomainsListState();
  }

  Future<void> _load({bool refresh = false}) async {
    state = state.copyWith(
      loading: !refresh,
      refreshing: refresh,
      error: refresh ? state.error : null,
    );
    try {
      final domains = await _repo.list();
      state = state.copyWith(
        domains: domains,
        loading: false,
        refreshing: false,
        error: null,
      );
    } on ApiError catch (e) {
      state = state.copyWith(
        loading: false,
        refreshing: false,
        error: refresh ? state.error : e,
      );
    }
  }

  /// Pull-to-refresh — keep the current rows if the reload fails.
  Future<void> refresh() => _load(refresh: true);

  /// Retry after a first-load failure.
  Future<void> retry() => _load();

  /// Reload silently after a mutation elsewhere (connect / verify / disconnect).
  Future<void> reload() => _load(refresh: true);
}

final domainsListControllerProvider =
    NotifierProvider<DomainsListController, DomainsListState>(
  DomainsListController.new,
);
