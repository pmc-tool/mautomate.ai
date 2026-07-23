import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:mautomate_shopper/core/api/store_product.dart";
import "package:mautomate_shopper/core/widgets/product_card.dart";
import "package:mautomate_shopper/features/catalog/catalog_list_controller.dart";
import "package:mautomate_shopper/features/catalog/product_grid_view.dart";

Widget _wrap(Widget child) => MaterialApp(
      home: Scaffold(
        body: SizedBox(width: 400, height: 800, child: child),
      ),
    );

StoreProduct _p(String id, String title) =>
    StoreProduct(id: id, title: title, handle: id);

void main() {
  group("ProductGridView", () {
    testWidgets("renders one ProductCard per loaded product", (tester) async {
      await tester.pumpWidget(_wrap(ProductGridView(
        state: CatalogListState(
          items: [_p("1", "Alpha Tee"), _p("2", "Beta Cap")],
          isLoadingInitial: false,
          hasMore: false,
        ),
        onRefresh: () async {},
        onLoadMore: () {},
      )));
      await tester.pump();

      expect(find.byType(ProductCard), findsNWidgets(2));
      expect(find.text("Alpha Tee"), findsOneWidget);
      expect(find.text("Beta Cap"), findsOneWidget);
    });

    testWidgets("shows the skeleton grid on first load", (tester) async {
      await tester.pumpWidget(_wrap(ProductGridView(
        state: const CatalogListState(isLoadingInitial: true),
        onRefresh: () async {},
        onLoadMore: () {},
      )));
      await tester.pump();

      expect(find.byType(ProductCardSkeleton), findsWidgets);
      expect(find.byType(ProductCard), findsNothing);
    });

    testWidgets("shows the empty state when loaded with no products",
        (tester) async {
      await tester.pumpWidget(_wrap(ProductGridView(
        state: const CatalogListState(isLoadingInitial: false),
        onRefresh: () async {},
        onLoadMore: () {},
        emptyTitle: "Nothing here",
        emptyMessage: "No products matched.",
      )));
      await tester.pump();

      expect(find.text("Nothing here"), findsOneWidget);
      expect(find.byType(ProductCard), findsNothing);
    });
  });
}
