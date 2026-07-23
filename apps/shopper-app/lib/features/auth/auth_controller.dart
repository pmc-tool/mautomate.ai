import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../core/api/api_error.dart";
import "auth_repository.dart";
import "auth_store.dart";
import "customer.dart";

/// Owns the customer session — state is a nullable-Customer AsyncValue: null means
/// signed out. Restores the session on boot from the stored token, and exposes
/// [login] / [register] / [logout]. Auth failures land in the state
/// (AsyncError) rather than throwing, so the screens read the outcome after
/// awaiting and never crash.
class AuthController extends AsyncNotifier<Customer?> {
  AuthRepository get _repo => ref.read(authRepositoryProvider);
  AuthStore get _store => ref.read(authStoreProvider);

  @override
  Future<Customer?> build() async {
    final token = await _store.readToken();
    if (token == null || token.isEmpty) return null;
    try {
      return await _repo.me(token);
    } catch (e) {
      final err = ApiError.from(e);
      if (err.status == 401 || err.status == 403) {
        // Expired/invalid token — forget it and present as signed out.
        await _store.deleteToken();
        return null;
      }
      rethrow;
    }
  }

  /// Whether a customer is currently signed in.
  bool get isLoggedIn => state.valueOrNull != null;

  Future<void> login({
    required String email,
    required String password,
  }) async {
    state = const AsyncLoading<Customer?>().copyWithPrevious(state);
    try {
      final token = await _repo.login(email: email, password: password);
      final me = await _repo.me(token);
      await _store.writeToken(token);
      state = AsyncData(me);
    } catch (e, st) {
      state = AsyncError<Customer?>(e, st).copyWithPrevious(state);
    }
  }

  Future<void> register({
    required String email,
    required String password,
    String? firstName,
    String? lastName,
  }) async {
    state = const AsyncLoading<Customer?>().copyWithPrevious(state);
    try {
      final registerToken =
          await _repo.register(email: email, password: password);
      await _repo.createCustomer(
        token: registerToken,
        email: email,
        firstName: firstName,
        lastName: lastName,
      );

      // The register token becomes the session token once the customer exists;
      // if that path is rejected we re-login to obtain a clean session token.
      var sessionToken = registerToken;
      Customer me;
      try {
        me = await _repo.me(sessionToken);
      } catch (_) {
        sessionToken = await _repo.login(email: email, password: password);
        me = await _repo.me(sessionToken);
      }

      await _store.writeToken(sessionToken);
      state = AsyncData(me);
    } catch (e, st) {
      state = AsyncError<Customer?>(e, st).copyWithPrevious(state);
    }
  }

  Future<void> logout() async {
    await _store.deleteToken();
    state = const AsyncData(null);
  }
}

final authControllerProvider =
    AsyncNotifierProvider<AuthController, Customer?>(AuthController.new);
