import "package:flutter/foundation.dart";

/// The signed-in shopper, parsed from Medusa /store/customers/me.
@immutable
class Customer {
  const Customer({
    required this.id,
    required this.email,
    this.firstName,
    this.lastName,
  });

  final String id;
  final String email;
  final String? firstName;
  final String? lastName;

  /// A friendly display name — full name when present, else the email.
  String get displayName {
    final name = [firstName, lastName]
        .where((p) => p != null && p.trim().isNotEmpty)
        .map((p) => p!.trim())
        .join(" ");
    return name.isNotEmpty ? name : email;
  }

  /// A one/two letter avatar initial.
  String get initials {
    final f = (firstName ?? "").trim();
    final l = (lastName ?? "").trim();
    if (f.isNotEmpty && l.isNotEmpty) {
      return "${f.substring(0, 1)}${l.substring(0, 1)}".toUpperCase();
    }
    final base = displayName.trim();
    return base.isNotEmpty ? base.substring(0, 1).toUpperCase() : "?";
  }

  factory Customer.fromJson(Map<String, dynamic> json) {
    String? s(String key) {
      final v = json[key];
      return v is String && v.trim().isNotEmpty ? v.trim() : null;
    }

    return Customer(
      id: (json["id"] as String?) ?? "",
      email: s("email") ?? "",
      firstName: s("first_name"),
      lastName: s("last_name"),
    );
  }
}
