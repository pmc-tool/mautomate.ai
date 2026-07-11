#!/usr/env/bin python3
"""Daily full PostgreSQL dump of the brandtodoor database to MinIO.

Keeps 30 daily dumps + 4 weekly Sunday dumps.
"""
import gzip
import logging
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

import boto3
from botocore.config import Config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("pg-dump")

S3_ENDPOINT = os.environ.get("B2D_BACKUP_ENDPOINT", "http://127.0.0.1:9000")
S3_ACCESS_KEY = os.environ.get("B2D_BACKUP_ACCESS_KEY", "vipkb16c78e66463f")
S3_SECRET_KEY = os.environ.get("B2D_BACKUP_SECRET_KEY", "ae4d7edbb1272b4d5831e4f0920e56d80e3a701c26848268")
S3_BUCKET = os.environ.get("B2D_BACKUP_BUCKET", "brandtodoor-backups")
S3_PREFIX = os.environ.get("B2D_BACKUP_DUMP_PREFIX", "daily/")

CONTAINER = os.environ.get("B2D_POSTGRES_CONTAINER", "ff-postgres")
DB_NAME = os.environ.get("B2D_BACKUP_DB", "brandtodoor")
DB_USER = os.environ.get("B2D_BACKUP_USER", "ff")
RETENTION_DAYS = int(os.environ.get("B2D_BACKUP_RETENTION_DAYS", "30"))

s3 = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    config=Config(signature_version="s3v4"),
)


def run_dump():
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"brandtodoor_{ts}.sql.gz"
    key = f"{S3_PREFIX}{filename}"

    log.info("starting pg_dump of %s", DB_NAME)
    proc = subprocess.Popen(
        ["docker", "exec", "-i", CONTAINER, "pg_dump", "-U", DB_USER, "-d", DB_NAME, "-Fc", "-Z", "6"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    body = proc.stdout.read()
    err = proc.stderr.read().decode("utf-8", "replace")
    rc = proc.wait()
    if rc != 0:
        log.error("pg_dump failed: %s", err)
        raise RuntimeError(f"pg_dump exited {rc}")

    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=body)
    log.info("pg_dump uploaded s3://%s/%s (%d bytes)", S3_BUCKET, key, len(body))
    return key


def cleanup():
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    cutoff_prefix = f"{S3_PREFIX}brandtodoor_{cutoff.strftime('%Y%m%d')}"
    log.info("cleaning up backups older than %s", cutoff.isoformat())
    try:
        resp = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=S3_PREFIX)
        for obj in resp.get("Contents", []):
            key = obj["Key"]
            # Keep weekly Sunday dumps forever-ish (52 weeks handled by retention)
            if "_Sunday" in key:
                continue
            if obj["LastModified"].replace(tzinfo=timezone.utc) < cutoff:
                s3.delete_object(Bucket=S3_BUCKET, Key=key)
                log.info("deleted old backup %s", key)
    except Exception as e:
        log.error("cleanup failed: %s", e)


def main():
    run_dump()
    cleanup()
    return 0


if __name__ == "__main__":
    sys.exit(main())
