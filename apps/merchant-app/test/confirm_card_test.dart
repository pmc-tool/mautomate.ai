import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/features/jarvis/data/jarvis_models.dart";
import "package:mautomate_merchant/features/jarvis/presentation/widgets/confirm_card.dart";

/// The confirm gate is SERVER-enforced; the app only renders it. These tests
/// pin the two tiers' local behaviour: soft = one tap, hard = type-the-word.
void main() {
  Widget host(Widget child) => MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(body: SingleChildScrollView(child: child)),
      );

  JarvisConfirm confirm({
    required ConfirmTier tier,
    String? requireText,
  }) =>
      JarvisConfirm(
        id: "cf1",
        action: "orders.fulfil",
        token: "tok_1",
        summary: "Fulfil order #1042?",
        tier: tier,
        requireText: requireText,
      );

  testWidgets("soft tier: a single Confirm tap fires the callback", (
    tester,
  ) async {
    String? confirmedWith;
    await tester.pumpWidget(
      host(
        ConfirmCard(
          confirm: confirm(tier: ConfirmTier.soft),
          onConfirm: (word) => confirmedWith = word,
          onDismiss: () {},
          onUndo: () {},
        ),
      ),
    );

    expect(find.text("Confirm"), findsOneWidget);
    await tester.tap(find.text("Confirm"));
    await tester.pump();

    // Soft confirm passes an empty word (no typed challenge).
    expect(confirmedWith, "");
  });

  testWidgets(
      "hard tier: Confirm is inert until the required word is typed, then fires",
      (tester) async {
    String? confirmedWith;
    await tester.pumpWidget(
      host(
        ConfirmCard(
          confirm: confirm(tier: ConfirmTier.hard, requireText: "DELETE"),
          onConfirm: (word) => confirmedWith = word,
          onDismiss: () {},
          onUndo: () {},
        ),
      ),
    );

    // Tapping before typing the word must NOT fire the callback.
    await tester.tap(find.text("Confirm"));
    await tester.pump();
    expect(confirmedWith, isNull);

    // Type the wrong word: still inert.
    await tester.enterText(find.byType(TextField), "delet");
    await tester.pump();
    await tester.tap(find.text("Confirm"));
    await tester.pump();
    expect(confirmedWith, isNull);

    // Type the exact required word (case-insensitive): now it fires.
    await tester.enterText(find.byType(TextField), "delete");
    await tester.pump();
    await tester.tap(find.text("Confirm"));
    await tester.pump();
    expect(confirmedWith, "delete");
  });
}
