import "package:flutter_test/flutter_test.dart";

import "package:mautomate_shopper/core/blocks/block_node.dart";

void main() {
  test("StorePage normalizes CMS sections shape", () {
    final page = StorePage.fromJson({
      "page": {
        "slug": "home",
        "sections": [
          {"block_type": "hero_slider", "schema_version": 1, "slides": []},
          {"block_type": "rich_text", "schema_version": 1, "html": "<p>hi</p>"},
        ],
      },
    });
    expect(page.content.length, 2);
    expect(page.content.first.type, "hero_slider");
    expect(page.content[1].props["html"], "<p>hi</p>");
  });

  test("StorePage skips malformed blocks without throwing", () {
    final page = StorePage.fromJson({
      "page": {
        "sections": [
          {"no_type": true},
          {"block_type": "rich_text", "html": "x"},
        ],
      },
    });
    expect(page.content.length, 1);
    expect(page.content.first.type, "rich_text");
  });
}
