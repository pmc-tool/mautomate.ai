import "package:flutter/foundation.dart";

/// A country a shopper may ship to, from a region's `countries[]`.
///
/// The store's region pins the countries the app may offer; the country picker
/// is limited to exactly this list so an address never lands outside the region
/// (which would make shipping options and completion fail).
@immutable
class Country {
  const Country({required this.iso2, required this.displayName});

  /// Two-letter ISO code (lower-case), what Medusa expects as `country_code`.
  final String iso2;

  /// A human label for the picker (falls back to the upper-cased code).
  final String displayName;

  factory Country.fromJson(Map<String, dynamic> json) {
    final iso = (json["iso_2"] as String?)?.trim().toLowerCase() ?? "";
    final name = (json["display_name"] as String?)?.trim();
    final region = (json["name"] as String?)?.trim();
    return Country(
      iso2: iso,
      displayName: (name != null && name.isNotEmpty)
          ? name
          : (region != null && region.isNotEmpty ? region : iso.toUpperCase()),
    );
  }
}

/// A delivery method offered for the cart, from `/store/shipping-options`.
///
/// [amount] is the delivery price in the same units the rest of the app feeds
/// [formatMoney] (the cart totals use the same convention), so a shipping line
/// renders consistently with the order summary.
@immutable
class ShippingOption {
  const ShippingOption({
    required this.id,
    required this.name,
    required this.amount,
    this.currencyCode,
  });

  final String id;
  final String name;

  /// Delivery price. Falls back to 0 (free) when the option came back unpriced.
  final num amount;

  final String? currencyCode;

  bool get isFree => amount <= 0;

  factory ShippingOption.fromJson(Map<String, dynamic> json) {
    num? amount;
    final calc = json["calculated_price"];
    if (calc is Map) {
      final v = calc["calculated_amount"];
      if (v is num) amount = v;
    }
    amount ??= json["amount"] is num ? json["amount"] as num : null;

    String? currency;
    if (calc is Map && calc["currency_code"] is String) {
      currency = calc["currency_code"] as String;
    }

    return ShippingOption(
      id: (json["id"] as String?) ?? "",
      name: (json["name"] as String?)?.trim().isNotEmpty == true
          ? (json["name"] as String).trim()
          : "Delivery",
      amount: amount ?? 0,
      currencyCode: currency,
    );
  }
}

/// A payment method available in the store's region, from
/// `/store/payment-providers`.
///
/// The app derives a friendly [label] and, critically, whether the provider is
/// a MANUAL one ([canCompleteWithoutCard]) — a manual/system/cash provider lets
/// the order be PLACED without any card credentials, which is the path the app
/// uses to complete an order. A card gateway (e.g. Stripe) is surfaced with a
/// clear card-entry section but never auto-filled.
@immutable
class PaymentProvider {
  const PaymentProvider({required this.id});

  final String id;

  /// Manual/offline providers can complete an order with no card entry.
  bool get canCompleteWithoutCard {
    final l = id.toLowerCase();
    return l.contains("system") ||
        l.contains("manual") ||
        l.contains("cod") ||
        l.contains("cash") ||
        l.contains("offline") ||
        l.contains("default");
  }

  /// Card gateways need shopper-entered card data at runtime.
  bool get requiresCardEntry {
    final l = id.toLowerCase();
    return l.contains("stripe") ||
        l.contains("card") ||
        l.contains("paypal") ||
        l.contains("razorpay") ||
        l.contains("adyen") ||
        l.contains("braintree");
  }

  /// A short, human-facing method name.
  String get label {
    final l = id.toLowerCase();
    if (l.contains("cod") || l.contains("cash")) return "Cash on delivery";
    if (l.contains("system") || l.contains("default") || l.contains("manual")) {
      return "Cash on delivery";
    }
    if (l.contains("stripe")) return "Credit or debit card";
    if (l.contains("paypal")) return "PayPal";
    if (l.contains("razorpay")) return "Razorpay";
    // Prettify an unknown id: pp_some_thing -> "Some thing".
    var s = id;
    if (s.startsWith("pp_")) s = s.substring(3);
    s = s.replaceAll("_", " ").trim();
    if (s.isEmpty) return id;
    return s[0].toUpperCase() + s.substring(1);
  }

  factory PaymentProvider.fromJson(Map<String, dynamic> json) =>
      PaymentProvider(id: (json["id"] as String?) ?? "");
}

/// The placed order returned by `POST /store/carts/:id/complete`.
@immutable
class CheckoutOrder {
  const CheckoutOrder({
    required this.id,
    this.displayId,
    this.email,
    this.total,
    this.currencyCode,
    this.itemCount = 0,
  });

  final String id;

  /// The human order number (e.g. 15), when present.
  final int? displayId;

  final String? email;
  final num? total;
  final String? currencyCode;
  final int itemCount;

  /// The order number to show the shopper — the display id, else a short id.
  String get reference {
    if (displayId != null) return "#$displayId";
    if (id.length > 8) return "#${id.substring(id.length - 8).toUpperCase()}";
    return id;
  }

  factory CheckoutOrder.fromJson(Map<String, dynamic> json) {
    num? total;
    final v = json["total"];
    if (v is num) {
      total = v;
    } else {
      final summary = json["summary"];
      if (summary is Map) {
        final ot = summary["original_order_total"] ?? summary["current_order_total"];
        if (ot is num) total = ot;
      }
    }

    var count = 0;
    final items = json["items"];
    if (items is List) {
      for (final it in items) {
        if (it is Map && it["quantity"] is num) {
          count += (it["quantity"] as num).toInt();
        }
      }
    }

    return CheckoutOrder(
      id: (json["id"] as String?) ?? "",
      displayId: json["display_id"] is num
          ? (json["display_id"] as num).toInt()
          : null,
      email: (json["email"] as String?)?.trim(),
      total: total,
      currencyCode: json["currency_code"] as String?,
      itemCount: count,
    );
  }
}

/// A mutable-friendly, immutable shipping/billing address input.
///
/// Held in the checkout state and serialised to the Medusa `shipping_address` /
/// `billing_address` shape on submit. Every field is a plain string so it binds
/// straight to a [TextEditingController]; [countryCode] is chosen from the
/// region's [Country] list.
@immutable
class AddressInput {
  const AddressInput({
    this.firstName = "",
    this.lastName = "",
    this.address1 = "",
    this.city = "",
    this.postalCode = "",
    this.province = "",
    this.countryCode = "",
    this.phone = "",
    this.company = "",
  });

  final String firstName;
  final String lastName;
  final String address1;
  final String city;
  final String postalCode;
  final String province;
  final String countryCode;
  final String phone;
  final String company;

  AddressInput copyWith({
    String? firstName,
    String? lastName,
    String? address1,
    String? city,
    String? postalCode,
    String? province,
    String? countryCode,
    String? phone,
    String? company,
  }) {
    return AddressInput(
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      address1: address1 ?? this.address1,
      city: city ?? this.city,
      postalCode: postalCode ?? this.postalCode,
      province: province ?? this.province,
      countryCode: countryCode ?? this.countryCode,
      phone: phone ?? this.phone,
      company: company ?? this.company,
    );
  }

  /// Whether the required fields for a valid Medusa address are present.
  bool get isComplete =>
      firstName.trim().isNotEmpty &&
      lastName.trim().isNotEmpty &&
      address1.trim().isNotEmpty &&
      city.trim().isNotEmpty &&
      postalCode.trim().isNotEmpty &&
      countryCode.trim().isNotEmpty;

  Map<String, dynamic> toJson() => {
        "first_name": firstName.trim(),
        "last_name": lastName.trim(),
        "address_1": address1.trim(),
        "city": city.trim(),
        "postal_code": postalCode.trim(),
        "country_code": countryCode.trim().toLowerCase(),
        if (province.trim().isNotEmpty) "province": province.trim(),
        if (phone.trim().isNotEmpty) "phone": phone.trim(),
        if (company.trim().isNotEmpty) "company": company.trim(),
      };
}
