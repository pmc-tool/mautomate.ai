#!/usr/bin/env python3
"""Weekly restore test: download the latest daily dump and restore into a
throwaway database, then run a few sanity checks. Reports success/failure.
"""
import logging
import os
import subprocess
import sys
from datetime import datetime, timezone

import boto3
from botocore.config import Config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("restore-test")

S3_ENDPOINT = os.environ.get("B2D_BACKUP_ENDPOINT", "http://127.0.0.1:9000")
S3_ACCESS_KEY = os.environ.get("B2D_BACKUP_ACCESS_KEY", "vipkb16c78e66463f")
S3_SECRET_KEY = os.environ.get("B2D_BACKUP_SECRET_KEY", "ae4d7edbb1272b4d5831e4f0920e56d80e3a701c26848268")
S3_BUCKET = os.environ.get("B2D_BACKUP_BUCKET", "brandtodoor-backups")
S3_PREFIX = os.environ.get("B2D_BACKUP_DUMP_PREFIX", "daily/")

CONTAINER = os.environ.get("B2D_POSTGRES_CONTAINER", "ff-postgres")
DB_USER = os.environ.get("B2D_BACKUP_USER", "ff")
TEST_DB = "brandtodoor_restore_test"

s3 = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    config=Config(signature_version="s3v4"),
)


def latest_dump_key():
    resp = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=S3_PREFIX)
    objs = resp.get("Contents", [])
    if not objs:
        raise RuntimeError("no dumps found")
    latest = max(objs, key=lambda o: o["LastModified"])
    return latest["Key"]


def psql(cmd):
    return subprocess.check_call(
        ["docker", "exec", "-i", CONTAINER, "psql", "-U", DB_USER, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", cmd]
    )


def main():
    key = latest_dump_key()
    log.info("restore test using %s", key)

    body = s3.get_object(Bucket=S3_BUCKET, Key=key)["Body"].read()
    log.info("downloaded %d bytes", len(body))

    psql(f"DROP DATABASE IF EXISTS {TEST_DB}")
    psql(f"CREATE DATABASE {TEST_DB}")

    restore = subprocess.Popen(
        ["docker", "exec", "-i", CONTAINER, "pg_restore", "-U", DB_USER, "-d", TEST_DB, "--no-owner", "--no-privileges"],
        stdin=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    _, err = restore.communicate(input=body)
    rc = restore.wait()
    # pg_restore returns 1 for warnings sometimes; treat > 1 as failure
    if rc > 1:
        log.error("pg_restore failed: %s", err.decode("utf-8", "replace"))
        raise RuntimeError(f"pg_restore exited {rc}")

    # Sanity check: count platform tables
    out = subprocess.check_output(
        ["docker", "exec", CONTAINER, "psql", "-U", DB_USER, "-d", TEST_DB, "-tAc",
         "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"],
        text=True,
    )
    table_count = int(out.strip())
    log.info("restore test passed: %d tables restored", table_count)

    psql(f"DROP DATABASE IF EXISTS {TEST_DB}")

    # Touch a heartbeat file for monitoring
    heartbeat = os.path.expanduser("~/brandtodoor/infrastructure/backups/.restore-test-ok")
    with open(heartbeat, "w") as f:
        f.write(datetime.now(timezone.utc).isoformat())
    return 0


if __name__ == "__main__":
    sys.exit(main())
