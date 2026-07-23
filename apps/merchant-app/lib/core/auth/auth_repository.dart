import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../api/api_error.dart";
import "../api/dio_client.dart";
import "auth_models.dart";

/// Thin transport for the auth + session endpoints, mirroring the web client's
/// `loginMerchant`, `verifyMfa` and `getMerchantMe` (function-for-function).
/// Orchestration (MFA detection, persistence) lives in [AuthController].
class AuthRepository {
  AuthRepository(this._dio);

  final Dio _dio;

  /// POST /auth/merchant/emailpass -> { token }
  Future<String> login({
    required String email,
    required String password,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        "/auth/merchant/emailpass",
        data: {"email": email, "password": password},
      );
      return _requireToken(res.data);
    } catch (e) {
      throw ApiError.from(e, fallback: "Sign-in failed");
    }
  }

  /// POST /auth/merchant/mfa/verify -> { token }
  Future<String> verifyMfa({
    required String token,
    required String code,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        "/auth/merchant/mfa/verify",
        data: {"token": token, "code": code},
      );
      return _requireToken(res.data);
    } catch (e) {
      throw ApiError.from(e, fallback: "Verification failed");
    }
  }

  /// GET /merchant/me -> { merchant, store }.
  ///
  /// Throws `ApiError(type: "mfa_required")` when the session still needs a
  /// second factor, exactly like the web client. The token is sent as an
  /// explicit header so this works before the token is persisted (login) and
  /// during background restore.
  Future<MeResponse> me(String token) async {
    try {
      final res = await _dio.get<dynamic>(
        "/merchant/me",
        options: Options(headers: {"authorization": "Bearer $token"}),
      );
      return MeResponse.fromJson(
        Map<String, dynamic>.from(res.data as Map),
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not load your account");
    }
  }

  String _requireToken(dynamic data) {
    final token = data is Map ? data["token"] : null;
    if (token is String && token.isNotEmpty) return token;
    throw ApiError("The server response was missing a session token.", 0);
  }
}

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(dioProvider)),
);
