"""
Structured JSON logging for the voice runtime.

One line = one JSON object with a stable set of keys (`ts`, `level`, `logger`,
`msg`) plus any structured `extra` a call site attaches (e.g. `call_id`,
`playbook_id`). This keeps per-call logs greppable in aggregation
(`grep '"call_id":"cc_123"'`) and machine-parseable by a log shipper.

Pipecat logs through `loguru`; `configure_logging` bridges loguru into the same
stdlib stream so pipecat's internal logs land in the same JSON stream at the
configured level instead of a second, differently-formatted sink.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone

_RESERVED = set(
    logging.makeLogRecord({}).__dict__.keys()
) | {"message", "asctime", "taskName"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        # Merge any structured context passed via `logger.info(msg, extra={...})`.
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                try:
                    json.dumps(value)
                    payload[key] = value
                except (TypeError, ValueError):
                    payload[key] = repr(value)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    # Bridge loguru (pipecat's logger) into stdlib so everything shares one sink.
    try:
        from loguru import logger as loguru_logger

        class _InterceptHandler(logging.Handler):
            pass

        loguru_logger.remove()

        def _sink(message):  # loguru message object
            record = message.record
            std_level = record["level"].name
            logging.getLogger("pipecat").log(
                logging.getLevelName(std_level)
                if isinstance(logging.getLevelName(std_level), int)
                else logging.INFO,
                record["message"],
            )

        loguru_logger.add(_sink, level=level)
    except Exception:  # noqa: BLE001 - loguru is optional at runtime
        pass


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
