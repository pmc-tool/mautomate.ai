import "package:flutter_riverpod/flutter_riverpod.dart";

import "../api/api_error.dart";
import "auth_models.dart";
import "auth_repository.dart";
import "secure_store.dart";

/// The four states the app shell keys off of.
enum AuthStatus { loading, signedOut, mfa, signedIn }

/// Immutable auth state. Mirrors the web `auth.tsx` state machine:
/// a stored token = enter the app and validate `/merchant/me` in the
/// background; only a 401 (or a pending MFA challenge) sends the merchant to
/// sign-in.
class AuthState {
  const AuthState({
    this.status = AuthStatus.loading,
    this.token,
    this.pendingToken,
    this.me,
    this.error,
    this.submitting = false,
  });

  /// Where the app is: splash, signed-out, mid-MFA, or in the app.
  final AuthStatus status;

  /// The live session token (read by the Dio interceptor for other requests).
  final String? token;

  /// The token awaiting a second factor (during the MFA step).
  final String? pendingToken;

  /// The loaded account, populated after `/merchant/me` succeeds.
  final MeResponse? me;

  /// The last user-facing error for the login/MFA screens.
  final String? error;

  /// True while a login/MFA submit is in flight.
  final bool submitting;

  static const Object _keep = Object();

  AuthState copyWith({
    AuthStatus? status,
    Object? token = _keep,
    Object? pendingToken = _keep,
    Object? me = _keep,
    Object? error = _keep,
    bool? submitting,
  }) {
    return AuthState(
      status: status ?? this.status,
      token: token == _keep ? this.token : token as String?,
      pendingToken:
          pendingToken == _keep ? this.pendingToken : pendingToken as String?,
      me: me == _keep ? this.me : me as MeResponse?,
      error: error == _keep ? this.error : error as String?,
      submitting: submitting ?? this.submitting,
    );
  }
}

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    // Read the stored token after construction so provider reads are safe.
    Future.microtask(_bootstrap);
    return const AuthState(status: AuthStatus.loading);
  }

  SecureStore get _store => ref.read(secureStoreProvider);
  AuthRepository get _repo => ref.read(authRepositoryProvider);

  /// Startup: a stored token means the merchant was already signed in, so enter
  /// the app immediately and validate the session in the background. Only a
  /// dead session (401) or a pending MFA challenge signs out; a transient
  /// network/5xx failure keeps the optimistic session.
  Future<void> _bootstrap() async {
    final stored = await _store.readToken();
    if (stored == null || stored.isEmpty) {
      state = const AuthState(status: AuthStatus.signedOut);
      return;
    }

    state = AuthState(status: AuthStatus.signedIn, token: stored);
    try {
      final me = await _repo.me(stored);
      state = state.copyWith(me: me);
    } on ApiError catch (e) {
      if (e.isUnauthorized || e.isMfaRequired) {
        await _store.deleteToken();
        state = const AuthState(status: AuthStatus.signedOut);
      }
      // Otherwise keep the optimistic session; screens surface their own errors.
    }
  }

  /// Sign in with email + password. On success we immediately load
  /// `/merchant/me`; an `mfa_required` there routes to the MFA step, holding the
  /// token as `pendingToken` (mirrors the web `login()` flow).
  Future<void> login({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(submitting: true, error: null);
    try {
      final token = await _repo.login(email: email, password: password);
      try {
        final me = await _repo.me(token);
        await _store.writeToken(token);
        state = AuthState(status: AuthStatus.signedIn, token: token, me: me);
      } on ApiError catch (e) {
        if (e.isMfaRequired) {
          state = AuthState(status: AuthStatus.mfa, pendingToken: token);
        } else {
          rethrow;
        }
      }
    } on ApiError catch (e) {
      state = state.copyWith(submitting: false, error: e.message);
    }
  }

  /// Complete the MFA challenge with the 6-digit code.
  Future<void> verifyMfa({required String code}) async {
    final pending = state.pendingToken;
    if (pending == null) {
      state = const AuthState(
        status: AuthStatus.signedOut,
        error: "Your sign-in session expired. Please sign in again.",
      );
      return;
    }
    state = state.copyWith(submitting: true, error: null);
    try {
      final token = await _repo.verifyMfa(token: pending, code: code);
      final me = await _repo.me(token);
      await _store.writeToken(token);
      state = AuthState(status: AuthStatus.signedIn, token: token, me: me);
    } on ApiError catch (e) {
      state = state.copyWith(submitting: false, error: e.message);
    }
  }

  /// Re-fetch `/merchant/me` for the current session (e.g. pull-to-refresh).
  Future<void> refreshMe() async {
    final token = state.token;
    if (token == null) return;
    final me = await _repo.me(token);
    state = state.copyWith(me: me);
  }

  /// Clear the session and return to sign-in. Safe to call when already signed
  /// out (idempotent); the Dio interceptor calls this on a 401.
  Future<void> signOut() async {
    await _store.deleteToken();
    state = const AuthState(status: AuthStatus.signedOut);
  }

  /// Cancel a pending MFA challenge and return to sign-in.
  void cancelMfa() {
    state = const AuthState(status: AuthStatus.signedOut);
  }

  void clearError() {
    if (state.error != null) state = state.copyWith(error: null);
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);
