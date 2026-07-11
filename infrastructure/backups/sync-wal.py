#!/usr/bin/env python3
"""Sync PostgreSQL WAL archive files from the ff-postgres container to MinIO."""
import hashlib
import logging
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

import boto3
from botocore.config import Config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("wal-sync")

S3_ENDPOINT = os.environ.get("B2D_BACKUP_ENDPOINT", "http://127.0.0.1:9000")
S3_ACCESS_KEY = os.environ.get("B2D_BACKUP_ACCESS_KEY", "vipkb16c78e66463f")
S3_SECRET_KEY = os.environ.get("B2D_BACKUP_SECRET_KEY", "ae4d7edbb1272b4d5831e4f0920e56d80e3a701c26848268")
S3_BUCKET = os.environ.get("B2D_BACKUP_BUCKET", "brandtodoor-backups")
S3_PREFIX = os.environ.get("B2D_BACKUP_WAL_PREFIX", "wal/")

CONTAINER = os.environ.get("B2D_POSTGRES_CONTAINER", "ff-postgres")
ARCHIVE_DIR = "/var/lib/postgresql/data/archives/wal"

s3 = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    config=Config(signature_version="s3v4"),
)


def container_ls():
    try:
        out = subprocess.check_output(
            ["docker", "exec", CONTAINER, "ls", "-1", ARCHIVE_DIR],
            stderr=subprocess.STDOUT,
            text=True,
        )
        return [f.strip() for f in out.splitlines() if f.strip() and not f.strip().endswith("/")]
    except subprocess.CalledProcessError:
        return []


def container_stat(filename):
    cmd = ["docker", "exec", CONTAINER, "stat", "-c", "%Y %s", f"{ARCHIVE_DIR}/{filename}"]
    out = subprocess.check_output(cmd, text=True).strip().split()
    return int(out[0]), int(out[1])


def container_read(filename):
    return subprocess.check_output(["docker", "exec", CONTAINER, "cat", f"{ARCHIVE_DIR}/{filename}"])


def remote_exists(key, etag):
    try:
        head = s3.head_object(Bucket=S3_BUCKET, Key=key)
        return head.get("ETag", "").strip('"') == etag
    except s3.exceptions.ClientError as e:
        if e.response["Error"]["Code"] == "404":
            return False
        raise


def upload_one(filename):
    key = f"{S3_PREFIX}{filename}"
    data = container_read(filename)
    etag = hashlib.md5(data).hexdigest()
    if remote_exists(key, etag):
        log.info("wal skip already present %s", filename)
        return True
    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=data)
    log.info("wal uploaded %s -> s3://%s/%s", filename, S3_BUCKET, key)
    return True


def safe_to_remove(filename, mtime_epoch):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    return datetime.fromtimestamp(mtime_epoch, tz=timezone.utc) < cutoff


def main():
    files = container_ls()
    if not files:
        return 0
    for filename in files:
        try:
            upload_one(filename)
        except Exception as e:
            log.error("failed to upload %s: %s", filename, e)
            continue
        try:
            mtime, _ = container_stat(filename)
            if safe_to_remove(filename, mtime):
                subprocess.check_call(["docker", "exec", CONTAINER, "rm", "-f", f"{ARCHIVE_DIR}/{filename}"])
                log.info("wal removed local %s", filename)
        except Exception as e:
            log.warning("failed to remove local wal %s: %s", filename, e)
    return 0


if __name__ == "__main__":
    sys.exit(main())
