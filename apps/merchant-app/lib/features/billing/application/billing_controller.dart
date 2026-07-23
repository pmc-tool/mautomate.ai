import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../data/billing_models.dart";
import "../data/billing_repository.dart";

/// Page size for the paginated credit history.
const int kCreditHistoryPage = 20;

/// A one-shot event the screen reacts to after a mutation: an informational
/// [notice] (e.g. plan applied, gateway not live), an [error] toast, or a
/// [checkoutUrl] the merchant must open in a browser to finish paying.
class BillingEvent {
  const BillingEvent({this.notice, this.error, this.checkoutUrl});
  final String? notice;
  final String? error;
  final String? checkoutUrl;
}

/// Immutable state for the Billing screen: the overview payload, the credit
/// history window, initial load/error flags, and per-action busy tags.
class BillingState {
  const BillingState({
    this.overview,
    this.credits,
    this.isLoading = true,
    this.isRefreshing = false,
    this.error,
    this.busyPackIndex,
    this.busyPlanKey,
    this.loadingMoreHistory = false,
    this.event,
  });

  final BillingOverview? overview;
  final CreditsHistory? credits;

  final bool isLoading;
  final bool isRefreshing;

  /// The initial-load error (drives the full-screen error state).
  final ApiError? error;

  /// Index of the pack whose purchase is in flight.
  final int? busyPackIndex;

  /// Key of the plan whose change is in flight.
  final String? busyPlanKey;

  /// A "load more" history fetch is in flight.
  final bool loadingMoreHistory;

  /// A one-shot event for the screen to surface (snackbar / checkout sheet).
  final BillingEvent? event;

  bool get hasMoreHistory => credits?.hasMore ?? false;

  static const Object _keep = Object();

  BillingState copyWith({
    Object? overview = _keep,
    Object? credits = _keep,
    bool? isLoading,
    bool? isRefreshing,
    Object? error = _keep,
    Object? busyPackIndex = _keep,
    Object? busyPlanKey = _keep,
    bool? loadingMoreHistory,
    Object? event = _keep,
  }) {
    return BillingState(
      overview: overview == _keep ? this.overview : overview as BillingOverview?,
      credits: credits == _keep ? this.credits : credits as CreditsHistory?,
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      error: error == _keep ? this.error : error as ApiError?,
      busyPackIndex:
          busyPackIndex == _keep ? this.busyPackIndex : busyPackIndex as int?,
      busyPlanKey:
          busyPlanKey == _keep ? this.busyPlanKey : busyPlanKey as String?,
      loadingMoreHistory: loadingMoreHistory ?? this.loadingMoreHistory,
      event: event == _keep ? this.event : event as BillingEvent?,
    );
  }
}

/// Loads the billing overview + credit history and runs the buy-pack /
/// change-plan actions. Both actions can end in a browser checkout, an
/// immediate apply, or a "gateway not live yet" notice — each surfaced through
/// a one-shot [BillingEvent].
class BillingController extends Notifier<BillingState> {
  BillingRepository get _repo => ref.read(billingRepositoryProvider);

  @override
  BillingState build() {
    Future.microtask(_load);
    return const BillingState();
  }

  Future<void> _load({bool refreshing = false}) async {
    state = state.copyWith(
      isLoading: refreshing ? state.isLoading : true,
      isRefreshing: refreshing,
      error: null,
    );
    try {
      final results = await Future.wait([
        _repo.getOverview(),
        _repo
            .getCredits(limit: kCreditHistoryPage, offset: 0)
            .then<CreditsHistory?>((v) => v)
            .catchError((_) => null),
      ]);
      state = state.copyWith(
        overview: results[0] as BillingOverview,
        credits: results[1] as CreditsHistory?,
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

  /// Pull-to-refresh.
  Future<void> refresh() => _load(refreshing: true);

  /// Re-run the initial load after an error.
  void retry() => _load();

  /// Clear the one-shot event once the screen has consumed it.
  void clearEvent() {
    if (state.event != null) state = state.copyWith(event: null);
  }

  /// Reveal the next page of credit history.
  Future<void> loadMoreHistory() async {
    final current = state.credits;
    if (current == null || !current.hasMore || state.loadingMoreHistory) return;
    state = state.copyWith(loadingMoreHistory: true);
    try {
      final next = current.transactions.length;
      final more = await _repo.getCredits(
        limit: kCreditHistoryPage,
        offset: next,
      );
      state = state.copyWith(
        credits: current.copyWith(
          transactions: [...current.transactions, ...more.transactions],
          hasMore: more.hasMore,
          count: more.count,
          offset: more.offset,
        ),
        loadingMoreHistory: false,
      );
    } catch (_) {
      // Keep what we have; failing to page shouldn't clear the list.
      state = state.copyWith(loadingMoreHistory: false);
    }
  }

  /// Buy a credit pack (POST /merchant/credits).
  Future<void> buyPack(int index) async {
    final packs = state.overview?.packs ?? const <BillingPack>[];
    if (index < 0 || index >= packs.length) return;
    final pack = packs[index];
    state = state.copyWith(busyPackIndex: index);
    try {
      final outcome = await _repo.buyPack(
        credits: pack.credits,
        amountUsd: pack.amountUsd,
      );
      if (outcome.hasCheckout) {
        state = state.copyWith(
          busyPackIndex: null,
          event: BillingEvent(checkoutUrl: outcome.checkoutUrl),
        );
      } else {
        state = state.copyWith(
          busyPackIndex: null,
          event: BillingEvent(
            notice: outcome.message ??
                "Card payments are being set up — please try again later.",
          ),
        );
      }
    } catch (e) {
      state = state.copyWith(
        busyPackIndex: null,
        event: BillingEvent(error: ApiError.from(e).message),
      );
    }
  }

  /// Change the subscription plan (POST /merchant/billing/change-plan).
  Future<void> changePlan(String key) async {
    if (key.isEmpty || key == state.overview?.currentPlan?.key) return;
    state = state.copyWith(busyPlanKey: key);
    try {
      final outcome = await _repo.changePlan(key);
      if (outcome.hasCheckout) {
        state = state.copyWith(
          busyPlanKey: null,
          event: BillingEvent(checkoutUrl: outcome.checkoutUrl),
        );
        return;
      }
      state = state.copyWith(
        busyPlanKey: null,
        event: BillingEvent(notice: outcome.message ?? "Plan updated."),
      );
      // The plan (and any granted allowance) changed server-side — refresh so
      // the current-plan card + wallet reflect it.
      await _load(refreshing: true);
    } catch (e) {
      state = state.copyWith(
        busyPlanKey: null,
        event: BillingEvent(error: ApiError.from(e).message),
      );
    }
  }
}

final billingControllerProvider =
    NotifierProvider<BillingController, BillingState>(BillingController.new);
