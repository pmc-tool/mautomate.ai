import "dart:math" as math;

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../data/call_center_models.dart";
import "../data/call_center_repository.dart";

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

/// Everything the Call Center overview needs, loaded together: today's
/// dashboard tallies, the store's voice agents, and its connected numbers.
class CallCenterOverviewState {
  const CallCenterOverviewState({
    this.dashboard,
    this.agents = const <CallAgent>[],
    this.phoneNumbers = const <CallPhoneNumber>[],
    this.isLoading = true,
    this.isRefreshing = false,
    this.error,
  });

  final CallCenterDashboard? dashboard;
  final List<CallAgent> agents;
  final List<CallPhoneNumber> phoneNumbers;

  /// Initial load in flight (no data yet).
  final bool isLoading;

  /// A pull-to-refresh is in flight (data already on screen).
  final bool isRefreshing;

  /// The last load error, when any.
  final ApiError? error;

  /// True once a load has completed with no agents, no numbers and no calls
  /// today — i.e. the call center hasn't been set up yet.
  bool get isNotSetUp =>
      !isLoading &&
      error == null &&
      agents.isEmpty &&
      phoneNumbers.isEmpty &&
      (dashboard?.callsToday.total ?? 0) == 0 &&
      (dashboard?.campaignsRunning ?? 0) == 0;

  /// Look up an agent's display name by id (for a number's attached agent).
  String? agentNameFor(String? agentId) {
    if (agentId == null || agentId.isEmpty) return null;
    for (final a in agents) {
      if (a.id == agentId) return a.name;
    }
    return null;
  }

  static const Object _keep = Object();

  CallCenterOverviewState copyWith({
    Object? dashboard = _keep,
    List<CallAgent>? agents,
    List<CallPhoneNumber>? phoneNumbers,
    bool? isLoading,
    bool? isRefreshing,
    Object? error = _keep,
  }) {
    return CallCenterOverviewState(
      dashboard:
          dashboard == _keep ? this.dashboard : dashboard as CallCenterDashboard?,
      agents: agents ?? this.agents,
      phoneNumbers: phoneNumbers ?? this.phoneNumbers,
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      error: error == _keep ? this.error : error as ApiError?,
    );
  }
}

/// Loads the overview surface. The dashboard is required; agents and numbers
/// are best-effort so a permission gap on one doesn't blank the whole screen.
class CallCenterOverviewController
    extends Notifier<CallCenterOverviewState> {
  @override
  CallCenterOverviewState build() {
    Future.microtask(_load);
    return const CallCenterOverviewState();
  }

  Future<void> _load({bool refreshing = false}) async {
    state = state.copyWith(
      isLoading: refreshing ? state.isLoading : true,
      isRefreshing: refreshing,
      error: null,
    );
    final repo = ref.read(callCenterRepositoryProvider);
    try {
      final results = await Future.wait([
        repo.getDashboard(),
        repo.listAgents().catchError((_) => <CallAgent>[]),
        repo
            .listPhoneNumbers()
            .catchError((_) => const PhoneNumbersResult()),
      ]);
      state = state.copyWith(
        dashboard: results[0] as CallCenterDashboard,
        agents: results[1] as List<CallAgent>,
        phoneNumbers: (results[2] as PhoneNumbersResult).phoneNumbers,
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

  /// Re-run the load after an error.
  void retry() => _load();
}

final callCenterOverviewControllerProvider =
    NotifierProvider<CallCenterOverviewController, CallCenterOverviewState>(
  CallCenterOverviewController.new,
);

// ---------------------------------------------------------------------------
// Call history
// ---------------------------------------------------------------------------

/// How many rows a "page" reveals as the merchant scrolls. The backend returns
/// the full (capped) result in one call, so paging is client-side.
const int kCallsPageSize = 20;

/// A selectable call-status filter (null = "All"), mirroring the web
/// `callStatuses`.
class CallStatusOption {
  const CallStatusOption(this.label, this.value);
  final String label;
  final String? value;
}

const List<CallStatusOption> kCallStatusOptions = [
  CallStatusOption("All", null),
  CallStatusOption("In progress", "in_progress"),
  CallStatusOption("Completed", "completed"),
  CallStatusOption("No answer", "no_answer"),
  CallStatusOption("Voicemail", "voicemail"),
  CallStatusOption("Failed", "failed"),
];

/// Immutable state for the call log: the server result, the visible window, the
/// active status filter, and load/error flags.
class CallHistoryState {
  const CallHistoryState({
    this.calls = const <CallCenterCall>[],
    this.isLoading = true,
    this.isRefreshing = false,
    this.error,
    this.status,
    this.visibleCount = kCallsPageSize,
  });

  final List<CallCenterCall> calls;
  final bool isLoading;
  final bool isRefreshing;
  final ApiError? error;
  final String? status;
  final int visibleCount;

  List<CallCenterCall> get visible =>
      calls.take(visibleCount).toList(growable: false);

  bool get hasMore => visibleCount < calls.length;

  bool get isEmpty => !isLoading && error == null && calls.isEmpty;

  bool get hasFilters => status != null;

  static const Object _keep = Object();

  CallHistoryState copyWith({
    List<CallCenterCall>? calls,
    bool? isLoading,
    bool? isRefreshing,
    Object? error = _keep,
    Object? status = _keep,
    int? visibleCount,
  }) {
    return CallHistoryState(
      calls: calls ?? this.calls,
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      error: error == _keep ? this.error : error as ApiError?,
      status: status == _keep ? this.status : status as String?,
      visibleCount: visibleCount ?? this.visibleCount,
    );
  }
}

/// Loads and filters the call log. Status changes and pull-to-refresh re-query
/// the server; scrolling reveals more of the loaded result without a request.
class CallHistoryController extends Notifier<CallHistoryState> {
  @override
  CallHistoryState build() {
    Future.microtask(_load);
    return const CallHistoryState();
  }

  Future<void> _load({bool refreshing = false}) async {
    state = state.copyWith(
      isLoading: refreshing ? state.isLoading : true,
      isRefreshing: refreshing,
      error: null,
    );
    try {
      final calls = await ref
          .read(callCenterRepositoryProvider)
          .listCalls(status: state.status);
      state = state.copyWith(
        calls: calls,
        isLoading: false,
        isRefreshing: false,
        error: null,
        visibleCount: kCallsPageSize,
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

  void loadMore() {
    if (!state.hasMore) return;
    state = state.copyWith(
      visibleCount:
          math.min(state.visibleCount + kCallsPageSize, state.calls.length),
    );
  }
}

final callHistoryControllerProvider =
    NotifierProvider<CallHistoryController, CallHistoryState>(
  CallHistoryController.new,
);

// ---------------------------------------------------------------------------
// Call detail
// ---------------------------------------------------------------------------

/// Loads one call's full detail (call, dispositions, agent, order). Family
/// keyed by call id; supports `ref.refresh(...future)` for pull-to-refresh.
final callDetailControllerProvider =
    FutureProvider.autoDispose.family<CallDetail, String>((ref, id) {
  return ref.read(callCenterRepositoryProvider).getCall(id);
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

/// Loads the last-30-days analytics summary. Supports
/// `ref.refresh(...future)` for pull-to-refresh.
final callAnalyticsControllerProvider =
    FutureProvider.autoDispose<CallCenterAnalytics>((ref) {
  final now = DateTime.now();
  final from = now.subtract(const Duration(days: 30));
  return ref.read(callCenterRepositoryProvider).getAnalytics(
        from: from.toUtc().toIso8601String(),
        to: now.toUtc().toIso8601String(),
      );
});
