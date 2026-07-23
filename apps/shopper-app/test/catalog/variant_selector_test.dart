import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:mautomate_shopper/features/catalog/product_detail.dart";
import "package:mautomate_shopper/features/catalog/variant_selector.dart";

ProductDetail _detail() => const ProductDetail(
      id: "p1",
      title: "Classic Tee",
      images: [],
      options: [
        ProductOption(id: "opt_size", title: "Size", values: ["S", "M"]),
      ],
      variants: [
        ProductVariant(
          id: "v_s",
          title: "S",
          optionValueByOptionId: {"opt_size": "S"},
          priceAmount: 10,
          currencyCode: "usd",
        ),
        ProductVariant(
          id: "v_m",
          title: "M",
          optionValueByOptionId: {"opt_size": "M"},
          priceAmount: 12,
          currencyCode: "usd",
        ),
      ],
    );

Widget _wrap(Widget child) => MaterialApp(
      home: Scaffold(body: SizedBox(width: 400, child: child)),
    );

void main() {
  group("ProductDetail selection logic", () {
    final detail = _detail();

    test("hasOptions is true for a multi-variant option matrix", () {
      expect(detail.hasOptions, isTrue);
    });

    test("variantForSelection resolves the matching variant", () {
      expect(detail.variantForSelection({"opt_size": "M"})?.id, "v_m");
      expect(detail.variantForSelection({"opt_size": "S"})?.id, "v_s");
    });

    test("variantForSelection is null until every option is chosen", () {
      expect(detail.variantForSelection(const {}), isNull);
    });

    test("isValueAvailable reflects reachable combinations", () {
      expect(detail.isValueAvailable("opt_size", "S", const {}), isTrue);
      expect(detail.isValueAvailable("opt_size", "M", const {}), isTrue);
    });
  });

  group("VariantSelector widget", () {
    testWidgets("renders a chip per option value and reports taps",
        (tester) async {
      String? tappedOption;
      String? tappedValue;

      await tester.pumpWidget(_wrap(VariantSelector(
        detail: _detail(),
        selected: const {},
        onSelect: (optionId, value) {
          tappedOption = optionId;
          tappedValue = value;
        },
      )));
      await tester.pump();

      expect(find.text("Size"), findsOneWidget);
      expect(find.text("S"), findsOneWidget);
      expect(find.text("M"), findsOneWidget);

      await tester.tap(find.text("S"));
      await tester.pump();

      expect(tappedOption, "opt_size");
      expect(tappedValue, "S");
    });

    testWidgets("marks the selected value", (tester) async {
      await tester.pumpWidget(_wrap(VariantSelector(
        detail: _detail(),
        selected: const {"opt_size": "M"},
        onSelect: (_, __) {},
      )));
      await tester.pump();

      // The selected chip renders its label bold (w700).
      final selected = tester.widget<Text>(find.text("M"));
      expect(selected.style?.fontWeight, FontWeight.w700);
    });
  });
}
