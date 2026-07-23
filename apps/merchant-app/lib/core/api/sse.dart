import "dart:async";
import "dart:convert";

import "package:dio/dio.dart";
import "package:flutter/foundation.dart" show visibleForTesting;

/// One parsed Server-Sent-Events frame: an [event] name and its JSON [data].
typedef SseFrame = ({String event, Map<String, dynamic> data});

/// POSTs [body] to [path] and yields SSE frames as they stream in.
///
/// Mirrors the web parser in
/// apps/storefront/src/components/merchant-admin/jarvis-panel.tsx: the byte
/// stream is decoded to text and split on a blank line ("\n\n"); within each
/// frame, `event:` sets the event name (default "message") and `data:` lines
/// are concatenated then JSON-parsed. Malformed data yields an empty map, never
/// throws, matching the web behaviour.
///
/// Used by the Jarvis chat/voice feature (POST /merchant/jarvis) later; the
/// foundation ships the transport so that feature agent can build on it.
Stream<SseFrame> postSse(
  Dio dio, {
  required String path,
  required Object body,
  String? token,
  CancelToken? cancelToken,
}) async* {
  final res = await dio.post<ResponseBody>(
    path,
    data: body,
    cancelToken: cancelToken,
    options: Options(
      responseType: ResponseType.stream,
      headers: {
        "content-type": "application/json",
        "accept": "text/event-stream",
        if (token != null && token.isNotEmpty) "authorization": "Bearer $token",
      },
    ),
  );

  final byteStream = res.data!.stream;
  yield* parseSseByteStream(byteStream.cast<List<int>>());
}

/// Decodes a raw SSE byte stream into frames, buffering across chunk
/// boundaries so a frame split awkwardly over several network chunks (or a
/// blank-line separator that straddles two chunks) is still parsed correctly.
///
/// Exposed for testing; [postSse] drives it with the live Dio byte stream. A
/// stateful UTF-8 decoder handles multi-byte characters that span chunks.
@visibleForTesting
Stream<SseFrame> parseSseByteStream(Stream<List<int>> bytes) async* {
  final textStream = bytes.transform(utf8.decoder);

  var buffer = "";
  await for (final text in textStream) {
    buffer += text;
    var idx = buffer.indexOf("\n\n");
    while (idx >= 0) {
      final frame = buffer.substring(0, idx);
      buffer = buffer.substring(idx + 2);
      final parsed = _parseFrame(frame);
      if (parsed != null) yield parsed;
      idx = buffer.indexOf("\n\n");
    }
  }

  // Flush a trailing frame that was not terminated by a blank line.
  final tail = _parseFrame(buffer);
  if (tail != null) yield tail;
}

/// Test hook for the frame parser (the same logic the stream loop uses).
@visibleForTesting
SseFrame? parseSseFrameForTest(String frame) => _parseFrame(frame);

SseFrame? _parseFrame(String frame) {
  if (frame.trim().isEmpty) return null;

  var event = "message";
  final dataBuf = StringBuffer();
  for (final rawLine in frame.split("\n")) {
    final line = rawLine.endsWith("\r")
        ? rawLine.substring(0, rawLine.length - 1)
        : rawLine;
    if (line.startsWith("event:")) {
      event = line.substring(6).trim();
    } else if (line.startsWith("data:")) {
      dataBuf.write(line.substring(5).trim());
    }
  }

  final dataStr = dataBuf.toString();
  var data = <String, dynamic>{};
  if (dataStr.isNotEmpty) {
    try {
      final decoded = jsonDecode(dataStr);
      if (decoded is Map) data = Map<String, dynamic>.from(decoded);
    } catch (_) {
      data = <String, dynamic>{};
    }
  }
  return (event: event, data: data);
}
