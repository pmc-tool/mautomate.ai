import "package:dio/dio.dart";
import "package:flutter/foundation.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../config/config_providers.dart";
import "api_error.dart";

/// A configured [Dio] for the Medusa **store** API.
///
/// Every request carries:
///  - the store [AppConfig.apiBaseUrl] as base URL,
///  - `x-publishable-api-key: <STORE_PUBLISHABLE_KEY>` — the header Medusa uses
///    to scope `/store/*` calls to ONE store's sales channel, and
///  - `x-tenant-id: <TENANT_ID>` — so pooled multi-tenant CMS reads (which
///    resolve the store from the request) bind to the right store even before a
///    per-store publishable key is provisioned.
///
/// Errors are mapped to a friendly [ApiError]. There is NO auth interceptor on
/// the home path: the shopper browses anonymously; customer auth (login, cart
/// ownership) is a later phase that will add a Bearer token here.
final storeDioProvider = Provider<Dio>((ref) {
  final config = ref.watch(appConfigProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 20),
      headers: {
        "content-type": "application/json",
        if (config.hasPublishableKey)
          "x-publishable-api-key": config.publishableKey,
        if (config.hasTenant) "x-tenant-id": config.tenantId,
      },
      validateStatus: (status) => status != null && status < 400,
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onError: (e, handler) {
        handler.reject(
          DioException(
            requestOptions: e.requestOptions,
            response: e.response,
            type: e.type,
            error: ApiError.fromDio(e),
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
