import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../core/api/api_error.dart";
import "../../core/api/dio_client.dart";
import "customer.dart";

/// Customer auth against Medusa v2 emailpass + the customer store endpoints.
///
/// Two-step register (get a token from the auth module, then create the
/// customer profile with it); login returns a token; authenticated reads send
/// the token as a Bearer alongside the publishable key (already on the Dio).
class AuthRepository {
  AuthRepository(this._dio);

  final Dio _dio;

  Options _bearer(String token) =>
      Options(headers: {"Authorization": "Bearer $token"});

  String _token(Map<String, dynamic>? body) {
    final t = body?["token"];
    if (t is String && t.isNotEmpty) return t;
    throw ApiError("Authentication failed. Please try again.", 0, "no_token");
  }

  /// Register an emailpass identity and return its token.
  Future<String> register({
    required String email,
    required String password,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/auth/customer/emailpass/register",
      data: {"email": email, "password": password},
    );
    return _token(res.data);
  }

  /// Log in and return the customer session token.
  Future<String> login({
    required String email,
    required String password,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/auth/customer/emailpass",
      data: {"email": email, "password": password},
    );
    return _token(res.data);
  }

  /// Create the customer profile (called once, right after register).
  Future<Customer> createCustomer({
    required String token,
    required String email,
    String? firstName,
    String? lastName,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/store/customers",
      data: {
        "email": email,
        if (firstName != null && firstName.trim().isNotEmpty)
          "first_name": firstName.trim(),
        if (lastName != null && lastName.trim().isNotEmpty)
          "last_name": lastName.trim(),
      },
      options: _bearer(token),
    );
    final raw = res.data?["customer"];
    if (raw is Map) return Customer.fromJson(raw.cast<String, dynamic>());
    return Customer(id: "", email: email, firstName: firstName, lastName: lastName);
  }

  /// Fetch the signed-in customer for a token.
  Future<Customer> me(String token) async {
    final res = await _dio.get<Map<String, dynamic>>(
      "/store/customers/me",
      options: _bearer(token),
    );
    final raw = res.data?["customer"];
    if (raw is Map) return Customer.fromJson(raw.cast<String, dynamic>());
    throw ApiError("Could not load your profile.", 0, "bad_shape");
  }
}

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(storeDioProvider)),
);
