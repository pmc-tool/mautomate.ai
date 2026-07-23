import "package:dio/dio.dart";

/// A typed, user-safe API error mirroring the web merchant client's `ApiError`
/// (apps/storefront/src/lib/merchant-admin/api.ts).
///
/// Carries the HTTP [status], an optional backend [type] discriminator
/// (e.g. "unauthorized", "mfa_required", "forbidden", "network"), and a
/// friendly, display-ready [message]. It never surfaces a raw gateway/HTML
/// body: 5xx and non-JSON responses collapse to a clean line, mirroring
/// `httpErrorMessage()` in the web client.
class ApiError implements Exception {
  ApiError(this.message, this.status, [this.type]);

  final String message;
  final int status;
  final String? type;

  bool get isUnauthorized => status == 401;
  bool get isForbidden => status == 403;
  bool get isMfaRequired => type == "mfa_required";

  /// Normalises anything thrown by Dio (or an already-typed [ApiError]) into an
  /// [ApiError]. The Dio interceptor stows a mapped [ApiError] on
  /// `DioException.error`; this unwraps it, or maps from scratch as a fallback.
  static ApiError from(Object error, {String fallback = "Request failed"}) {
    if (error is ApiError) return error;
    if (error is DioException) {
      final wrapped = error.error;
      if (wrapped is ApiError) return wrapped;
      return ApiError.fromDio(error, fallback: fallback);
    }
    return ApiError(error.toString(), 0);
  }

  /// Maps a Dio failure into a friendly [ApiError].
  factory ApiError.fromDio(
    DioException e, {
    String fallback = "Request failed",
  }) {
    final res = e.response;

    // No response at all -> network, timeout or connection failure.
    if (res == null) {
      switch (e.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          return ApiError(
            "The connection timed out. Please try again.",
            0,
            "timeout",
          );
        case DioExceptionType.cancel:
          return ApiError("The request was cancelled.", 0, "cancelled");
        default:
          return ApiError(
            "Can't reach the server. Check your connection and try again.",
            0,
            "network",
          );
      }
    }

    final status = res.statusCode ?? 0;

    // Pull message/type out of a JSON { message | error, type } body if present.
    String? serverMessage;
    String? serverType;
    final data = res.data;
    if (data is Map) {
      final m = data["message"] ?? data["error"];
      if (m is String && m.isNotEmpty) serverMessage = m;
      final t = data["type"];
      if (t is String && t.isNotEmpty) serverType = t;
    }

    if (status == 401) {
      return ApiError(
        serverMessage ?? "Your session has expired. Please sign in again.",
        401,
        serverType ?? "unauthorized",
      );
    }
    if (status == 403) {
      return ApiError(
        serverMessage ?? "Access denied.",
        403,
        serverType ?? "forbidden",
      );
    }
    if (status >= 500) {
      if (status == 502 || status == 503 || status == 504) {
        return ApiError(
          "The service is temporarily unavailable. Please try again in a moment.",
          status,
          serverType,
        );
      }
      return ApiError("$fallback ($status). Please try again.", status, serverType);
    }
    return ApiError(serverMessage ?? "$fallback ($status)", status, serverType);
  }

  @override
  String toString() =>
      "ApiError($status${type != null ? ", $type" : ""}): $message";
}
