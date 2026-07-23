import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../../../core/api/dio_client.dart";
import "product_models.dart";

/// The set of product statuses the backend accepts.
class ProductStatus {
  const ProductStatus._();

  static const String draft = "draft";
  static const String published = "published";
  static const String proposed = "proposed";
  static const String rejected = "rejected";
}

/// One absolute stock-level write for the batch stock endpoint: set the
/// on-hand [stockedQuantity] for an inventory item at a location. Mirrors the
/// backend `UpdateStockSchema.updates[]` shape (POST /merchant/products/{id}/stock).
class StockLevelUpdate {
  const StockLevelUpdate({
    required this.inventoryItemId,
    required this.locationId,
    required this.stockedQuantity,
  });

  final String inventoryItemId;
  final String locationId;
  final int stockedQuantity;

  Map<String, dynamic> toJson() => {
        "inventory_item_id": inventoryItemId,
        "location_id": locationId,
        "stocked_quantity": stockedQuantity,
      };
}

/// Transport for the merchant product catalogue. Mirrors the web client's
/// `listProductsPaged`, `getProduct`, `updateProduct`, `createProduct`,
/// `listStoreCurrencies` and the stock endpoints
/// (apps/storefront/src/lib/merchant-admin/api.ts) function-for-function.
///
/// The ambient session token is attached by the Dio interceptor, so these calls
/// stay token-free. Every failure is normalised to a friendly [ApiError].
class ProductsRepository {
  ProductsRepository(this._dio);

  final Dio _dio;

  /// `GET /merchant/products` — a searchable, paginated, tenant-scoped page.
  ///
  /// [q] full-text searches title/handle; [status] filters to the given
  /// statuses; [order] is a backend sort key (e.g. `-created_at`).
  Future<ProductPage> list({
    String? q,
    int offset = 0,
    int limit = 20,
    List<String>? status,
    String? order,
  }) async {
    try {
      final query = <String, dynamic>{
        "offset": offset,
        "limit": limit,
      };
      if (q != null && q.trim().isNotEmpty) query["q"] = q.trim();
      if (status != null && status.isNotEmpty) query["status"] = status.join(",");
      if (order != null && order.isNotEmpty) query["order"] = order;

      final res = await _dio.get<dynamic>(
        "/merchant/products",
        queryParameters: query,
      );
      return ProductPage.fromJson(Map<String, dynamic>.from(res.data as Map));
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not load your products");
    }
  }

  /// `GET /merchant/products/{id}` — the full product with variants (prices +
  /// available stock), images and organisation.
  Future<ProductDetail> detail(String id) async {
    try {
      final res = await _dio.get<dynamic>("/merchant/products/$id");
      return ProductDetailResponse.fromJson(
        Map<String, dynamic>.from(res.data as Map),
      ).product;
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not load this product");
    }
  }

  /// `POST /merchant/products` — create a product with a single default variant.
  ///
  /// Mirrors the web `createProduct` for the simple (no explicit options)
  /// path: the backend synthesises one default variant from the top-level
  /// [price], [inventoryQuantity] and [sku]. An optional [imageUrl] is set as
  /// the thumbnail and first gallery image (the backend accepts image URLs on
  /// create natively). Returns the new product's id so the caller can open it.
  Future<String> create({
    required String title,
    String? handle,
    String? description,
    required String status,
    required num price,
    required String currencyCode,
    required int inventoryQuantity,
    String? sku,
    String? imageUrl,
  }) async {
    try {
      final body = <String, dynamic>{
        "title": title.trim(),
        "status": status,
        "prices": [
          {"amount": price, "currency_code": currencyCode},
        ],
        "inventory_quantity": inventoryQuantity,
      };
      final h = handle?.trim();
      if (h != null && h.isNotEmpty) body["handle"] = h;
      final d = description?.trim();
      if (d != null && d.isNotEmpty) body["description"] = d;
      final s = sku?.trim();
      if (s != null && s.isNotEmpty) body["sku"] = s;
      final img = imageUrl?.trim();
      if (img != null && img.isNotEmpty) {
        body["thumbnail"] = img;
        body["images"] = [
          {"url": img},
        ];
      }

      final res = await _dio.post<dynamic>("/merchant/products", data: body);
      final data = Map<String, dynamic>.from(res.data as Map);
      final product = Map<String, dynamic>.from(data["product"] as Map);
      return product["id"] as String;
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not create the product");
    }
  }

  /// `POST /merchant/products/{id}/media` (multipart, field `image`) — uploads
  /// a local image file and sets it as the product thumbnail. Provided for a
  /// future gallery-pick flow; the create form attaches images by URL today.
  Future<void> uploadMedia(String productId, String filePath) async {
    try {
      final form = FormData.fromMap({
        "image": await MultipartFile.fromFile(filePath),
      });
      await _dio.post<dynamic>(
        "/merchant/products/$productId/media",
        data: form,
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not upload the image");
    }
  }

  /// `GET /merchant/store/currencies` — the codes the merchant can price in,
  /// plus the default (also first in the list). Powers the create form's
  /// currency selector.
  Future<StoreCurrencies> storeCurrencies() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/store/currencies");
      return StoreCurrencies.fromJson(
        Map<String, dynamic>.from(res.data as Map),
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not load store currencies");
    }
  }

  /// `GET /merchant/products/{id}/stock` — the per-variant stock matrix (each
  /// variant's inventory item and its on-hand level at every tenant location).
  Future<StockMatrix> stock(String productId) async {
    try {
      final res = await _dio.get<dynamic>("/merchant/products/$productId/stock");
      return StockMatrix.fromJson(
        Map<String, dynamic>.from(res.data as Map),
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not load stock");
    }
  }

  /// `POST /merchant/products/{id}/stock` — batch-set absolute on-hand levels.
  /// Creates missing levels and updates existing ones. Used by the restock flow.
  Future<void> setStock(String productId, List<StockLevelUpdate> updates) async {
    try {
      await _dio.post<dynamic>(
        "/merchant/products/$productId/stock",
        data: {"updates": updates.map((u) => u.toJson()).toList()},
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not update stock");
    }
  }

  /// `PUT /merchant/products/{id}` with a partial body. Returns the fresh
  /// product so callers can re-render from the server's truth.
  Future<ProductDetail> _update(String id, Map<String, dynamic> body) async {
    try {
      final res = await _dio.put<dynamic>(
        "/merchant/products/$id",
        data: body,
      );
      return ProductDetailResponse.fromJson(
        Map<String, dynamic>.from(res.data as Map),
      ).product;
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not save your changes");
    }
  }

  /// Publish or unpublish a product (`status` -> `published` / `draft`).
  Future<ProductDetail> updateStatus(String id, String status) {
    return _update(id, {"status": status});
  }

  /// Set a single variant's price for [currencyCode] (major units).
  Future<ProductDetail> updateVariantPrice(
    String productId,
    String variantId,
    num amount,
    String currencyCode,
  ) {
    return _update(productId, {
      "variants": [
        {
          "id": variantId,
          "prices": [
            {"amount": amount, "currency_code": currencyCode},
          ],
        },
      ],
    });
  }

  /// Set a single variant's available stock.
  Future<ProductDetail> updateVariantInventory(
    String productId,
    String variantId,
    int quantity,
  ) {
    return _update(productId, {
      "variants": [
        {"id": variantId, "inventory_quantity": quantity},
      ],
    });
  }
}

final productsRepositoryProvider = Provider<ProductsRepository>(
  (ref) => ProductsRepository(ref.watch(dioProvider)),
);
