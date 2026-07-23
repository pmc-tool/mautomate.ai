import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../data/domain_models.dart";
import "../data/domains_repository.dart";

/// State for the "find a new domain" search.
///
/// [idle] is the pre-search resting state (nothing searched yet). [loading]
/// drives the skeleton while a query is in flight; [response] holds the last
/// successful result set; [error] a failed search (with retry).
class DomainSearchState {
  const DomainSearchState({
    this.query = "",
    this.idle = true,
    this.loading = false,
    this.response,
    this.error,
  });

  final String query;
  final bool idle;
  final bool loading;
  final DomainSearchResponse? response;
  final ApiError? error;

  List<DomainSearchResult> get results => response?.results ?? const [];

  /// True when the registrar is wired (instant registration + real prices).
  /// Null until the first result comes back.
  bool? get configured => response?.configured;

  bool get isEmpty =>
      !loading && error == null && response != null && results.isEmpty;

  DomainSearchState copyWith({
    String? query,
    bool? idle,
    bool? loading,
    Object? response = _keep,
    Object? error = _keep,
  }) {
    return DomainSearchState(
      query: query ?? this.query,
      idle: idle ?? this.idle,
      loading: loading ?? this.loading,
      response:
          response == _keep ? this.response : response as DomainSearchResponse?,
      error: error == _keep ? this.error : error as ApiError?,
    );
  }

  static const Object _keep = Object();
}

/// Runs the availability search. Kept explicit (submit-driven, not per-keystroke)
/// because each query hits the registrar — the merchant taps search / submits.
class DomainSearchController extends AutoDisposeNotifier<DomainSearchState> {
  DomainsRepository get _repo => ref.read(domainsRepositoryProvider);

  @override
  DomainSearchState build() => const DomainSearchState();

  /// Search for [rawQuery] (a name, with or without a TLD). No-op on empty input.
  Future<void> search(String rawQuery) async {
    final query = rawQuery.trim().toLowerCase();
    if (query.isEmpty) return;
    state = state.copyWith(
      query: query,
      idle: false,
      loading: true,
      error: null,
    );
    try {
      final res = await _repo.search(query);
      // Drop a stale response if the merchant searched again meanwhile.
      if (state.query != query) return;
      state = state.copyWith(loading: false, response: res, error: null);
    } on ApiError catch (e) {
      if (state.query != query) return;
      state = state.copyWith(loading: false, error: e);
    }
  }

  /// Retry the last query after a failure.
  Future<void> retry() {
    if (state.query.isEmpty) return Future.value();
    return search(state.query);
  }
}

final domainSearchControllerProvider =
    AutoDisposeNotifierProvider<DomainSearchController, DomainSearchState>(
  DomainSearchController.new,
);

/// The DNS record set for a registrar-managed [domain]
/// (`GET /merchant/domains/:domain/dns`). Auto-disposed per domain; refresh by
/// invalidating the family entry.
final dnsRecordsProvider =
    FutureProvider.autoDispose.family<List<DnsRecord>, String>(
  (ref, domain) => ref.watch(domainsRepositoryProvider).dnsRecords(domain),
);
