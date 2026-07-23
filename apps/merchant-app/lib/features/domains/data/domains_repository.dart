import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../../../core/api/dio_client.dart";
import "domain_models.dart";

/// Transport for the store's domains. Mirrors the web merchant client's
/// `listDomains`, `connectDomain`, `disconnectDomain`, `verifyDomain`,
/// `searchDomainsForPurchase`, `buyDomainForStore` and `getDomainDnsRecords`
/// (apps/storefront/src/lib/merchant-admin/api.ts) function-for-function.
///
/// The ambient session token is attached by the Dio interceptor, so these calls
/// stay token-free. Every failure is normalised to a friendly [ApiError]; the
/// backend's own message (e.g. an upgrade prompt or "domain already connected")
/// is preserved so the UI can show exactly what went wrong.
class DomainsRepository {
  DomainsRepository(this._dio);

  final Dio _dio;

  static Map<String, dynamic> _asMap(dynamic data) =>
      Map<String, dynamic>.from(data as Map);

  /// `GET /merchant/domains` — the free subdomain plus connected/registered
  /// domains, each with its SSL/verification state and any pending DNS steps.
  Future<List<Domain>> list() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/domains");
      return DomainsResponse.fromJson(_asMap(res.data)).domains;
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not load your domains");
    }
  }

  /// `POST /merchant/domains` — connect a domain the merchant already owns.
  /// Returns the DNS/nameserver changes to make plus the new domain id.
  Future<ConnectDomainResponse> connect(String domain) async {
    try {
      final res = await _dio.post<dynamic>(
        "/merchant/domains",
        data: {"domain": domain},
      );
      return ConnectDomainResponse.fromJson(_asMap(res.data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not connect that domain");
    }
  }

  /// `DELETE /merchant/domains` — disconnect a custom domain by its id.
  Future<void> disconnect(String domainId) async {
    try {
      await _dio.delete<dynamic>(
        "/merchant/domains",
        data: {"domain_id": domainId},
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not disconnect that domain");
    }
  }

  /// `POST /merchant/domains/verify` — re-check DNS/SSL for a connected domain.
  Future<VerifyDomainResponse> verify(String domainId) async {
    try {
      final res = await _dio.post<dynamic>(
        "/merchant/domains/verify",
        data: {"domain_id": domainId},
      );
      return VerifyDomainResponse.fromJson(_asMap(res.data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not check the domain status");
    }
  }

  /// `POST /merchant/domains/search` — availability + pricing across TLDs.
  Future<DomainSearchResponse> search(String query, {List<String>? tlds}) async {
    try {
      final body = <String, dynamic>{"query": query};
      if (tlds != null && tlds.isNotEmpty) body["tlds"] = tlds;
      final res = await _dio.post<dynamic>(
        "/merchant/domains/search",
        data: body,
      );
      return DomainSearchResponse.fromJson(_asMap(res.data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not search for domains");
    }
  }

  /// `POST /merchant/domains/buy` — register a new domain (or, when the
  /// registrar is not configured, file a manual-approval request). This is a
  /// PURCHASE: the server enforces entitlement, availability and payment, so the
  /// UI only gates it behind an explicit confirm — the charge happens here.
  Future<DomainBuyResponse> buy({
    required String domainName,
    int years = 1,
    bool privacy = true,
    bool autoRenew = true,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        "/merchant/domains/buy",
        data: {
          "domain_name": domainName,
          "years": years,
          "privacy": privacy,
          "auto_renew": autoRenew,
        },
      );
      return DomainBuyResponse.fromJson(_asMap(res.data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not register that domain");
    }
  }

  /// `GET /merchant/domains/:domain/dns` — the DNS record set for a
  /// registrar-managed domain (empty for connect-only domains).
  Future<List<DnsRecord>> dnsRecords(String domain) async {
    try {
      final res = await _dio.get<dynamic>(
        "/merchant/domains/${Uri.encodeComponent(domain)}/dns",
      );
      return DnsRecordsResponse.fromJson(_asMap(res.data)).records;
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not load DNS records");
    }
  }
}

final domainsRepositoryProvider = Provider<DomainsRepository>(
  (ref) => DomainsRepository(ref.watch(dioProvider)),
);
