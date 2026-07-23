import "package:dio/dio.dart";
import "package:flutter/foundation.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../auth/auth_controller.dart";
import "api_error.dart";

/// The PUBLIC backend origin the app talks to.
///
/// Override at build time with `--dart-define=API_BASE_URL=https://...`.
/// Staging default is the canonical mAutomate merchant control-plane host,
/// which proxies `/merchant` + `/auth` on every host (confirmed: it returns
/// JSON `{ type, message }` errors for the merchant routes). The web dashboard
/// calls these same routes same-origin; the app needs the absolute origin.
const String kApiBaseUrl = String.fromEnvironment(
  "API_BASE_URL",
  defaultValue: "https://merchant.mautomate.ai",
);

/// A configured [Dio] with:
///  - the base URL above,
///  - an interceptor that attaches `Authorization: Bearer <token>` from the
///    auth store (unless the caller set one explicitly),
///  - error mapping to a friendly [ApiError], and
///  - global sign-out on a 401 for an authenticated session.
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: kApiBaseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 20),
      headers: {"content-type": "application/json"},
      // Anything >= 400 flows through onError so we map it uniformly.
      validateStatus: (status) => status != null && status < 400,
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        // Attach the ambient session token unless the caller set its own
        // (auth requests pass an explicit header during login/restore).
        final hasAuth = options.headers.keys
            .any((k) => k.toLowerCase() == "authorization");
        if (!hasAuth) {
          final token = ref.read(authControllerProvider).token;
          if (token != null && token.isNotEmpty) {
            options.headers["authorization"] = "Bearer $token";
          }
        }
        handler.next(options);
      },
      onError: (e, handler) {
        final apiError = ApiError.fromDio(e);
        // A 401 on an EXISTING session means the token is dead -> sign out.
        // Guarding on a present token stops a failed sign-in attempt (also 401)
        // from spuriously toggling global auth state.
        if (apiError.isUnauthorized &&
            ref.read(authControllerProvider).token != null) {
          ref.read(authControllerProvider.notifier).signOut();
        }
        handler.reject(
          DioException(
            requestOptions: e.requestOptions,
            response: e.response,
            type: e.type,
            error: apiError,
          ),
        );
      },
    ),
  );

  if (kDebugMode) {
    dio.interceptors.add(
      LogInterceptor(requestBody: false, responseBody: false),
    );
  }

  return dio;
});
