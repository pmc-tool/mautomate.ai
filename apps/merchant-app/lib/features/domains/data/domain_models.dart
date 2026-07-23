// @JsonKey on a freezed factory parameter is the generator-supported pattern —
// the annotation is forwarded to the generated field, so the lint is a false
// positive (same convention as the Products + Home DTOs).
// ignore_for_file: invalid_annotation_target
import "package:freezed_annotation/freezed_annotation.dart";

part "domain_models.freezed.dart";
part "domain_models.g.dart";

/// A single DNS change the merchant must make to connect a custom domain.
///
/// Mirrors the backend routing service (`GET/POST /merchant/domains`):
///   - "ns"    — nameserver to set at the registrar (apex domains; the pair of
///               "ns" records is the customer's ONLY step)
///   - "cname" — routing record (subdomain -> our origin)
///   - "txt"   — ownership + SSL validation records (legacy)
///   - "note"  — freeform guidance
@freezed
class DnsInstruction with _$DnsInstruction {
  const factory DnsInstruction({
    @Default("note") String kind,
    @Default("") String name,
    @Default("") String value,
    int? ttl,
  }) = _DnsInstruction;

  factory DnsInstruction.fromJson(Map<String, dynamic> json) =>
      _$DnsInstructionFromJson(json);
}

/// A domain attached to the store: the free mautomate.ai subdomain, plus any
/// connected or registrar-managed custom domains. From `GET /merchant/domains`.
@freezed
class Domain with _$Domain {
  const factory Domain({
    required String id,
    @Default("") String domain,
    // "free" | "custom"
    @Default("custom") String type,
    @JsonKey(name: "is_primary") @Default(false) bool isPrimary,
    @JsonKey(name: "ssl_status") @Default("") String sslStatus,
    @JsonKey(name: "verification_status")
    @Default("")
    String verificationStatus,
    @Default(<DnsInstruction>[]) List<DnsInstruction> instructions,
    // true when purchased/transferred through the platform registrar (registrar
    // tools apply); false for connected-only domains at the customer's provider.
    @JsonKey(name: "registrar_managed")
    @Default(false)
    bool registrarManaged,
  }) = _Domain;

  factory Domain.fromJson(Map<String, dynamic> json) => _$DomainFromJson(json);
}

/// `GET /merchant/domains` — the free subdomain plus connected/registered domains.
@freezed
class DomainsResponse with _$DomainsResponse {
  const factory DomainsResponse({
    @Default(<Domain>[]) List<Domain> domains,
  }) = _DomainsResponse;

  factory DomainsResponse.fromJson(Map<String, dynamic> json) =>
      _$DomainsResponseFromJson(json);
}

/// `POST /merchant/domains` — the connect result: the new domain id plus the
/// DNS/nameserver changes the merchant must make and a human message.
@freezed
class ConnectDomainResponse with _$ConnectDomainResponse {
  const factory ConnectDomainResponse({
    @JsonKey(name: "domain_id") required String domainId,
    @Default("") String domain,
    @Default(<DnsInstruction>[]) List<DnsInstruction> instructions,
    @Default("") String message,
  }) = _ConnectDomainResponse;

  factory ConnectDomainResponse.fromJson(Map<String, dynamic> json) =>
      _$ConnectDomainResponseFromJson(json);
}

/// `POST /merchant/domains/verify` — the re-checked DNS/SSL state. [pending] is
/// true while the change is still propagating (keep polling / retry later).
@freezed
class VerifyDomainResponse with _$VerifyDomainResponse {
  const factory VerifyDomainResponse({
    @JsonKey(name: "domain_id") @Default("") String domainId,
    @JsonKey(name: "ssl_status") @Default("") String sslStatus,
    @JsonKey(name: "verification_status")
    @Default("")
    String verificationStatus,
    @Default(true) bool pending,
  }) = _VerifyDomainResponse;

  factory VerifyDomainResponse.fromJson(Map<String, dynamic> json) =>
      _$VerifyDomainResponseFromJson(json);
}

/// A TLD price bundle (register / renew / transfer) in major currency units.
@freezed
class DomainPrice with _$DomainPrice {
  const factory DomainPrice({
    @Default(0) num register,
    @Default(0) num renew,
    @Default(0) num transfer,
    @Default("USD") String currency,
  }) = _DomainPrice;

  factory DomainPrice.fromJson(Map<String, dynamic> json) =>
      _$DomainPriceFromJson(json);
}

/// One availability result for a searched name at a specific TLD.
@freezed
class DomainSearchResult with _$DomainSearchResult {
  const factory DomainSearchResult({
    @Default("") String domain,
    @Default("") String tld,
    @Default(false) bool available,
    @Default("") String status,
    @JsonKey(name: "isPremium") @Default(false) bool isPremium,
    DomainPrice? price,
  }) = _DomainSearchResult;

  factory DomainSearchResult.fromJson(Map<String, dynamic> json) =>
      _$DomainSearchResultFromJson(json);
}

/// `POST /merchant/domains/search` — availability + pricing across TLDs.
/// [configured] is false when the registrar is not yet wired (prices are
/// estimates and buying becomes a manual-approval request).
@freezed
class DomainSearchResponse with _$DomainSearchResponse {
  const factory DomainSearchResponse({
    @Default("") String query,
    @Default(false) bool configured,
    @Default(<DomainSearchResult>[]) List<DomainSearchResult> results,
    String? note,
  }) = _DomainSearchResponse;

  factory DomainSearchResponse.fromJson(Map<String, dynamic> json) =>
      _$DomainSearchResponseFromJson(json);
}

/// `POST /merchant/domains/buy` — the purchase result. A domain is paid for with
/// a CARD, so the server creates the order `awaiting_payment` and hands back a
/// [checkoutUrl]; the domain is only registered once the payment webhook
/// confirms. The client must send the merchant to [checkoutUrl] and never treat
/// an unpaid order as registered.
@freezed
class DomainBuyResponse with _$DomainBuyResponse {
  const factory DomainBuyResponse({
    @Default(false) bool ok,
    @JsonKey(name: "awaiting_payment") @Default(false) bool awaitingPayment,
    @JsonKey(name: "order_id") String? orderId,
    @Default("") String domain,
    @JsonKey(name: "price_usd") num? priceUsd,
    @Default(1) int years,
    @JsonKey(name: "checkout_url") String? checkoutUrl,
  }) = _DomainBuyResponse;

  factory DomainBuyResponse.fromJson(Map<String, dynamic> json) =>
      _$DomainBuyResponseFromJson(json);
}

/// A DNS record on a registrar-managed domain (`GET /merchant/domains/:d/dns`).
@freezed
class DnsRecord with _$DnsRecord {
  const factory DnsRecord({
    String? id,
    @Default("") String type,
    @Default("") String host,
    @Default("") String value,
    int? ttl,
    int? priority,
  }) = _DnsRecord;

  factory DnsRecord.fromJson(Map<String, dynamic> json) =>
      _$DnsRecordFromJson(json);
}

/// `GET /merchant/domains/:domain/dns` — the record set for a managed domain.
@freezed
class DnsRecordsResponse with _$DnsRecordsResponse {
  const factory DnsRecordsResponse({
    @Default(<DnsRecord>[]) List<DnsRecord> records,
  }) = _DnsRecordsResponse;

  factory DnsRecordsResponse.fromJson(Map<String, dynamic> json) =>
      _$DnsRecordsResponseFromJson(json);
}
