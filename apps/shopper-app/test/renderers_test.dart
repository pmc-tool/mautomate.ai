import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:mautomate_shopper/core/api/catalog_binding.dart";
import "package:mautomate_shopper/core/api/store_product.dart";
import "package:mautomate_shopper/core/blocks/block_data.dart";
import "package:mautomate_shopper/core/blocks/block_node.dart";
import "package:mautomate_shopper/core/blocks/renderers/product_grid_block.dart";
import "package:mautomate_shopper/core/blocks/renderers/rich_text_block.dart";
import "package:mautomate_shopper/core/blocks/renderers/testimonials_block.dart";
import "package:mautomate_shopper/core/config/app_config.dart";

const _config = AppConfig(
  apiBaseUrl: "https://example.com",
  publishableKey: "",
  tenantId: "",
  cmsBase: "https://example.com",
);

BlockData _data(String type, Map<String, dynamic> props) =>
    BlockData(BlockNode(type: type, props: props), _config);

Widget _host(
  Widget Function(BuildContext) build, {
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(child: Builder(builder: build)),
      ),
    ),
  );
}

void main() {
  testWidgets("rich_text renders HTML heading + paragraph without throwing",
      (tester) async {
    await tester.pumpWidget(
      _host(
        (ctx) => richTextBlock(
          ctx,
          _data("rich_text", {
            "html": "<h2>Our Story</h2><p>Handmade goods, made to last.</p>",
          }),
        ),
      ),
    );
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(
      find.textContaining("Our Story", findRichText: true),
      findsWidgets,
    );
    expect(
      find.textContaining("Handmade goods", findRichText: true),
      findsWidgets,
    );
  });

  testWidgets("testimonials renders title, quote and author", (tester) async {
    await tester.pumpWidget(
      _host(
        (ctx) => testimonialsBlock(
          ctx,
          _data("testimonials", {
            "title": "Loved by customers",
            "items": [
              {
                "quote": "Amazing quality!",
                "author": "Jane D",
                "role": "Verified buyer",
              },
            ],
          }),
        ),
      ),
    );
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.text("Loved by customers"), findsOneWidget);
    expect(find.textContaining("Amazing quality"), findsOneWidget);
    expect(find.text("Jane D"), findsOneWidget);
  });

  testWidgets("product_tabs renders live product cards from its binding",
      (tester) async {
    const product = StoreProduct(
      id: "prod_1",
      title: "Test Mug",
      priceAmount: 19.99,
      currencyCode: "usd",
    );

    await tester.pumpWidget(
      _host(
        (ctx) => productGridBlock(
          ctx,
          _data("product_tabs", {
            "tabs": [
              {"label": "All", "source": "all", "limit": 4},
            ],
          }),
        ),
        overrides: [
          catalogProductsProvider
              .overrideWith((ref, binding) async => [product]),
        ],
      ),
    );
    // First frame: loading skeletons. Second frame: resolved data.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(tester.takeException(), isNull);
    expect(find.text("Test Mug"), findsOneWidget);
    expect(find.textContaining("19.99"), findsWidgets);
  });
}
