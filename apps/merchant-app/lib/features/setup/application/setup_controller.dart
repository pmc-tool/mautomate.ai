import "dart:typed_data";

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../data/setup_models.dart";
import "../data/setup_repository.dart";

/// The wizard steps, in order. Each maps to a card in the resumable step list.
/// `brand` is optional; the rest gate whether the store can take an order (the
/// server decides via [SetupStatus], never a local "clicked Next").
enum SetupStep { basics, brand, products, delivery, payments, review }

extension SetupStepX on SetupStep {
  /// The draft key persisted to the server (mirrors the web `StepKey`).
  String get key {
    switch (this) {
      case SetupStep.basics:
        return "basics";
      case SetupStep.brand:
        return "brand";
      case SetupStep.products:
        return "products";
      case SetupStep.delivery:
        return "delivery";
      case SetupStep.payments:
        return "payments";
      case SetupStep.review:
        return "review";
    }
  }

  String get title {
    switch (this) {
      case SetupStep.basics:
        return "Business basics";
      case SetupStep.brand:
        return "Brand & logo";
      case SetupStep.products:
        return "Products";
      case SetupStep.delivery:
        return "Delivery";
      case SetupStep.payments:
        return "Payments";
      case SetupStep.review:
        return "Review & go live";
    }
  }

  /// Optional steps can be skipped without blocking go-live.
  bool get optional => this == SetupStep.brand;

  static SetupStep? fromKey(String? key) {
    for (final s in SetupStep.values) {
      if (s.key == key) return s;
    }
    return null;
  }
}

/// Immutable state for the setup wizard: the loaded snapshot (with the embedded
/// verified status), the initial-load flags, and any load error.
class SetupState {
  const SetupState({
    this.data,
    this.isLoading = true,
    this.isRefreshing = false,
    this.error,
  });

  /// The full snapshot from GET /merchant/setup (status embedded).
  final SetupSnapshot? data;

  /// Initial load in flight (no data yet).
  final bool isLoading;

  /// A re-read after a mutation / pull-to-refresh (data already on screen).
  final bool isRefreshing;

  /// The last initial-load error, when any.
  final ApiError? error;

  SetupStatus? get status => data?.status;

  /// The step to resume on — the persisted `current_step`, else the first
  /// step that isn't verified-done, else basics.
  SetupStep get resumeStep {
    final persisted = SetupStepX.fromKey(data?.setup.currentStep);
    if (persisted != null) return persisted;
    return SetupStep.basics;
  }

  static const Object _keep = Object();

  SetupState copyWith({
    Object? data = _keep,
    bool? isLoading,
    bool? isRefreshing,
    Object? error = _keep,
  }) {
    return SetupState(
      data: data == _keep ? this.data : data as SetupSnapshot?,
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      error: error == _keep ? this.error : error as ApiError?,
    );
  }
}

/// Loads the setup snapshot and drives every per-step mutation. Each mutation
/// re-reads GET /merchant/setup afterwards so the verified progress (ticks,
/// percent, "ready to sell") updates live. Mutations throw an [ApiError] on
/// failure so the calling step can show an inline, actionable message.
class SetupController extends Notifier<SetupState> {
  @override
  SetupState build() {
    Future.microtask(_load);
    return const SetupState();
  }

  SetupRepository get _repo => ref.read(setupRepositoryProvider);

  Future<void> _load({bool refreshing = false}) async {
    state = state.copyWith(
      isLoading: refreshing ? state.isLoading : true,
      isRefreshing: refreshing,
      error: null,
    );
    try {
      final data = await _repo.getSetup();
      state = state.copyWith(
        data: data,
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

  /// Pull-to-refresh / post-mutation re-read — keeps data on screen.
  Future<void> refresh() => _load(refreshing: true);

  /// Retry after an initial-load failure.
  void retry() => _load();

  // --- Draft bookkeeping ----------------------------------------------------

  /// Persist the current step so a reload resumes here (fire-and-forget UX; a
  /// failure is non-fatal and silently ignored, matching the web).
  Future<void> setCurrentStep(SetupStep step) async {
    final draft = _draft().copyWith(currentStep: step.key);
    try {
      final updated = await _repo.patchSetup(draft: draft);
      _mergeSnapshot(updated);
    } catch (_) {
      // Non-fatal: the step still opens locally.
    }
  }

  /// Mark a step completed or skipped in the persisted draft.
  Future<void> persistStep(
    SetupStep step, {
    bool completed = false,
    bool skipped = false,
  }) async {
    final draft = _draft();
    final done = {...draft.completed};
    final skip = {...draft.skipped};
    if (completed) {
      done.add(step.key);
      skip.remove(step.key);
    }
    if (skipped) {
      skip.add(step.key);
      done.remove(step.key);
    }
    final next = draft.copyWith(
      currentStep: step.key,
      completed: done.toList(),
      skipped: skip.toList(),
      startedAt: draft.startedAt ?? DateTime.now().toUtc().toIso8601String(),
    );
    final updated = await _repo.patchSetup(draft: next);
    _mergeSnapshot(updated);
  }

  // --- Step mutations -------------------------------------------------------

  /// Business basics: name, country, currency and business details. Currency is
  /// persisted first so its validation surfaces before the step is marked done.
  Future<void> saveBasics({
    required String name,
    required String defaultCountry,
    required String currency,
    required String businessType,
    required String category,
  }) async {
    final current = (state.data?.currencyCode ?? "usd").toLowerCase();
    final next = currency.toLowerCase();
    if (next.isNotEmpty && next != current) {
      await _repo.updateCurrencies(
        currencies: [next],
        defaultCurrency: next,
      );
    }
    await _repo.patchSetup(
      name: name.trim(),
      defaultCountry: defaultCountry,
      business: SetupBusiness(type: businessType, category: category),
    );
    await persistStep(SetupStep.basics, completed: true);
    await refresh();
  }

  /// Save the brand description (logo is uploaded / picked separately).
  Future<void> saveBrand({required String description}) async {
    await _repo.patchSetup(
      business: SetupBusiness(description: description.trim()),
    );
    await persistStep(SetupStep.brand, completed: true);
    await refresh();
  }

  /// Upload a logo image (multipart). Returns the hosted URL; the server
  /// persists it, so the snapshot is re-read afterwards.
  Future<String> uploadLogo({
    required Uint8List bytes,
    required String filename,
    void Function(double progress)? onProgress,
  }) async {
    final url = await _repo.uploadLogo(
      bytes: bytes,
      filename: filename,
      onProgress: onProgress,
    );
    await refresh();
    return url;
  }

  /// AI-generate logo candidates (metered). Returns their URLs; nothing is
  /// applied until the merchant picks one.
  Future<List<String>> generateLogos({String? prompt}) {
    return _repo.generateLogos(prompt: prompt);
  }

  /// Apply a chosen logo URL to the store.
  Future<void> pickLogo(String url) async {
    await _repo.patchSetup(logoUrl: url);
    await refresh();
  }

  /// One-call quick delivery. [amountMinor] is in minor units (cents).
  Future<void> saveDelivery({
    required List<String> countries,
    required String priceType,
    int amountMinor = 0,
  }) async {
    await _repo.setDelivery(
      countries: countries,
      priceType: priceType,
      amount: amountMinor,
    );
    await persistStep(SetupStep.delivery, completed: true);
    await refresh();
  }

  /// Remove the placeholder sample product. Returns how many were removed.
  Future<int> removeDemo() async {
    final n = await _repo.removeDemo();
    await refresh();
    return n;
  }

  /// Mark the wizard finished (records completed_at in the draft).
  Future<void> finish() async {
    final draft = _draft().copyWith(
      currentStep: SetupStep.review.key,
      completedAt: DateTime.now().toUtc().toIso8601String(),
    );
    final updated = await _repo.patchSetup(draft: draft);
    _mergeSnapshot(updated);
    await refresh();
  }

  // --- Internals ------------------------------------------------------------

  SetupDraft _draft() => state.data?.setup ?? const SetupDraft();

  /// PATCH returns a snapshot WITHOUT the status block — merge it onto the
  /// current data so the verified status stays until the next full re-read.
  void _mergeSnapshot(SetupSnapshot updated) {
    final merged = updated.copyWith(status: state.data?.status);
    state = state.copyWith(data: merged);
  }
}

final setupControllerProvider =
    NotifierProvider<SetupController, SetupState>(SetupController.new);
