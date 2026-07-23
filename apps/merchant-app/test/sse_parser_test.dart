import "dart:convert";

import "package:flutter_test/flutter_test.dart";
import "package:mautomate_merchant/core/api/sse.dart";

/// Mirrors the web Jarvis frame parser in jarvis-panel.tsx.
void main() {
  group("SSE frame parser", () {
    test("parses an explicit event and JSON data", () {
      final frame = parseSseFrameForTest(
        'event: tool\ndata: {"id":"t1","label":"Reading orders","state":"done"}',
      );
      expect(frame, isNotNull);
      expect(frame!.event, "tool");
      expect(frame.data["id"], "t1");
      expect(frame.data["label"], "Reading orders");
      expect(frame.data["state"], "done");
    });

    test("defaults the event name to 'message'", () {
      final frame = parseSseFrameForTest('data: {"text":"Hi there"}');
      expect(frame, isNotNull);
      expect(frame!.event, "message");
      expect(frame.data["text"], "Hi there");
    });

    test("concatenates multiple data lines", () {
      final frame = parseSseFrameForTest(
        'event: confirm\ndata: {"token":"abc",\ndata: "tier":"hard"}',
      );
      expect(frame, isNotNull);
      expect(frame!.event, "confirm");
      expect(frame.data["token"], "abc");
      expect(frame.data["tier"], "hard");
    });

    test("tolerates malformed JSON with an empty map, never throws", () {
      final frame = parseSseFrameForTest("event: error\ndata: {not json");
      expect(frame, isNotNull);
      expect(frame!.event, "error");
      expect(frame.data, isEmpty);
    });

    test("ignores empty/whitespace-only frames", () {
      expect(parseSseFrameForTest(""), isNull);
      expect(parseSseFrameForTest("   \n  "), isNull);
    });

    test("strips a trailing carriage return (CRLF streams)", () {
      final frame = parseSseFrameForTest('event: done\r\ndata: {}\r');
      expect(frame, isNotNull);
      expect(frame!.event, "done");
    });
  });

  group("SSE byte-stream (chunked)", () {
    // A realistic Jarvis run: thinking -> tool -> message -> done, each frame
    // separated by a blank line, exactly as the backend streams it.
    const payload =
        'event: thinking\ndata: {}\n\n'
        'event: tool\n'
        'data: {"id":"t1","label":"Reading orders","state":"running"}\n\n'
        'event: message\ndata: {"text":"You have 3 unfulfilled orders."}\n\n'
        'event: done\ndata: {"conversation_id":"c9"}\n\n';

    // Splits [bytes] into fixed-size chunks so frame bodies AND the "\n\n"
    // separators land mid-chunk — the awkward boundaries the parser must buffer
    // across.
    List<List<int>> chunk(List<int> bytes, int size) {
      final out = <List<int>>[];
      for (var i = 0; i < bytes.length; i += size) {
        out.add(bytes.sublist(i, (i + size).clamp(0, bytes.length)));
      }
      return out;
    }

    Future<List<SseFrame>> collect(List<List<int>> chunks) =>
        parseSseByteStream(Stream.fromIterable(chunks)).toList();

    Future<void> assertParses(List<List<int>> chunks) async {
      final frames = await collect(chunks);
      expect(frames.map((f) => f.event).toList(),
          ["thinking", "tool", "message", "done"]);
      expect(frames[1].data["id"], "t1");
      expect(frames[1].data["label"], "Reading orders");
      expect(frames[1].data["state"], "running");
      expect(frames[2].data["text"], "You have 3 unfulfilled orders.");
      expect(frames[3].data["conversation_id"], "c9");
    }

    test("parses frames split into single-byte chunks", () async {
      // Every "\n\n" separator is split across chunk boundaries.
      await assertParses(chunk(utf8.encode(payload), 1));
    });

    test("parses frames split into awkward 5-byte chunks", () async {
      await assertParses(chunk(utf8.encode(payload), 5));
    });

    test("parses when the whole stream arrives as one chunk", () async {
      await assertParses([utf8.encode(payload)]);
    });

    test("flushes a trailing frame not terminated by a blank line", () async {
      final bytes = utf8.encode('event: message\ndata: {"text":"tail"}');
      final frames = await collect(chunk(bytes, 3));
      expect(frames, hasLength(1));
      expect(frames.single.event, "message");
      expect(frames.single.data["text"], "tail");
    });

    test("handles a multi-byte UTF-8 char split across chunks", () async {
      // The GBP sign (£, 2 bytes in UTF-8) is deliberately fragmented.
      final bytes = utf8.encode('event: message\ndata: {"text":"£48.00"}\n\n');
      final frames = await collect(chunk(bytes, 1));
      expect(frames.single.data["text"], "£48.00");
    });
  });
}
