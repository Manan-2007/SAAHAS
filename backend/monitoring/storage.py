"""Object storage for recordings: a small bucket interface with two drivers.

  local (default)  files under data/bucket/, encrypted at rest with the same
                   key as the database fields (monitoring.crypto). Nothing to
                   set up - it works offline, which is what a demo or an
                   on-premise deployment needs.
  s3               any S3-compatible bucket: Supabase Storage, MinIO,
                   Cloudflare R2, AWS S3. Objects are encrypted client-side
                   before upload, so the provider only ever holds ciphertext.

Pick one with SAHAAS_STORAGE (`local` | `s3`). For s3:

    SAHAAS_STORAGE=s3
    SAHAAS_S3_BUCKET=sahaas-recordings
    SAHAAS_S3_ENDPOINT=https://<project>.supabase.co/storage/v1/s3   # omit for AWS
    SAHAAS_S3_REGION=ap-south-1
    AWS_ACCESS_KEY_ID=...        AWS_SECRET_ACCESS_KEY=...

Keys are `<user_id>/<attachment_id>.<ext>`, so one victim's objects can be
listed and deleted as a unit when they erase their account.

Audio never reaches a bucket unless the victim turned on the
`store_recordings` consent - the default is off.
"""

import hashlib
import io
import os
import shutil
import wave
from pathlib import Path

import numpy as np

from . import crypto, db

MAX_UPLOAD_BYTES = int(os.environ.get("SAHAAS_MAX_UPLOAD_BYTES", 25 * 1024 * 1024))
CONTENT_TYPES = {".wav": "audio/wav", ".mp3": "audio/mpeg"}


class StorageError(RuntimeError):
    pass


class TooLarge(StorageError):
    pass


# ---------------------------------------------------------------- drivers

class LocalBucket:
    """Encrypted files on disk. `root` defaults to data/bucket/."""

    name = "local"

    def __init__(self, root=None):
        self.root = Path(root or os.environ.get("SAHAAS_BUCKET_DIR", db.DATA_DIR / "bucket"))

    def _path(self, key):
        path = (self.root / key).resolve()
        # is_relative_to, not a string prefix: ".../bucket-old" starts with ".../bucket"
        if not path.is_relative_to(self.root.resolve()):
            raise StorageError("Refusing a bucket key that escapes the bucket directory")
        return path

    def put(self, key, data, content_type=None):
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(crypto.enc_bytes(data))
        return {"driver": self.name, "key": key}

    def get(self, key):
        path = self._path(key)
        if not path.is_file():
            raise StorageError(f"No object at {key}")
        return crypto.dec_bytes(path.read_bytes())

    def delete(self, key):
        path = self._path(key)
        path.unlink(missing_ok=True)
        # Drop the per-user folder once it empties out.
        parent = path.parent
        if parent != self.root.resolve() and parent.is_dir() and not any(parent.iterdir()):
            parent.rmdir()

    def delete_prefix(self, prefix):
        target = self._path(prefix)
        if target.is_dir():
            shutil.rmtree(target, ignore_errors=True)

    def describe(self):
        return {"driver": self.name, "location": str(self.root)}


class S3Bucket:
    """S3-compatible storage (Supabase / MinIO / R2 / AWS), client-side encrypted."""

    name = "s3"

    def __init__(self, bucket=None, endpoint=None, region=None):
        try:
            import boto3
        except ImportError as exc:      # pragma: no cover - depends on the deployment
            raise StorageError("SAHAAS_STORAGE=s3 needs boto3: pip install boto3") from exc
        self.bucket = bucket or os.environ.get("SAHAAS_S3_BUCKET")
        if not self.bucket:
            raise StorageError("SAHAAS_STORAGE=s3 needs SAHAAS_S3_BUCKET")
        self.endpoint = endpoint or os.environ.get("SAHAAS_S3_ENDPOINT") or None
        self.region = region or os.environ.get("SAHAAS_S3_REGION") or None
        self.client = boto3.client("s3", endpoint_url=self.endpoint, region_name=self.region)

    def put(self, key, data, content_type=None):
        self.client.put_object(Bucket=self.bucket, Key=key, Body=crypto.enc_bytes(data),
                               ContentType="application/octet-stream",
                               Metadata={"original-content-type": content_type or "application/octet-stream"})
        return {"driver": self.name, "key": key, "bucket": self.bucket}

    def get(self, key):
        try:
            obj = self.client.get_object(Bucket=self.bucket, Key=key)
        except Exception as exc:
            raise StorageError(f"No object at {key}: {exc}") from exc
        return crypto.dec_bytes(obj["Body"].read())

    def delete(self, key):
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def delete_prefix(self, prefix):
        prefix = prefix.rstrip("/") + "/"
        token = None
        while True:
            kwargs = {"Bucket": self.bucket, "Prefix": prefix}
            if token:
                kwargs["ContinuationToken"] = token
            page = self.client.list_objects_v2(**kwargs)
            keys = [{"Key": o["Key"]} for o in page.get("Contents", [])]
            if keys:
                self.client.delete_objects(Bucket=self.bucket, Delete={"Objects": keys})
            if not page.get("IsTruncated"):
                return
            token = page.get("NextContinuationToken")

    def describe(self):
        return {"driver": self.name, "bucket": self.bucket, "endpoint": self.endpoint, "region": self.region}


_bucket = None


def bucket():
    """The configured bucket, built once."""
    global _bucket
    if _bucket is None:
        kind = os.environ.get("SAHAAS_STORAGE", "local").strip().lower()
        if kind in ("local", "file", ""):
            _bucket = LocalBucket()
        elif kind in ("s3", "supabase", "minio", "r2"):
            _bucket = S3Bucket()
        else:
            raise StorageError(f"Unknown SAHAAS_STORAGE={kind!r} (expected 'local' or 's3')")
    return _bucket


def use_bucket(new_bucket):
    """Swap the driver in (tests, or a caller wiring its own)."""
    global _bucket
    _bucket = new_bucket
    return _bucket


def status():
    try:
        return bucket().describe()
    except StorageError as exc:
        return {"driver": None, "error": str(exc)}


# ---------------------------------------------------------------- audio helpers

def encode_wav(samples, sample_rate):
    """float32 mono [-1, 1] -> 16-bit PCM WAV bytes, for saving a live check-in."""
    audio = np.clip(np.asarray(samples, dtype=np.float32), -1.0, 1.0)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(int(sample_rate))
        wav.writeframes((audio * 32767).astype("<i2").tobytes())
    return buf.getvalue()


# ---------------------------------------------------------------- attachments

def save_recording(user, data, kind="voice_note", content_type="audio/wav", suffix=".wav",
                   duration_s=None, detail=None, now=None):
    """Stores one recording for a victim and records the row that points at it.

    Returns None when the victim hasn't consented to keeping recordings, so
    callers can hand this any check-in and let consent decide.
    """
    if not user["consent"].get("store_recordings"):
        return None
    if len(data) > MAX_UPLOAD_BYTES:
        raise TooLarge(f"Recording is larger than the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit")

    now = now or db.now()
    attachment_id = db.new_id()
    key = f"{user['id']}/{attachment_id}{suffix}"
    bucket().put(key, data, content_type)
    try:
        with db.connect() as conn:
            conn.execute(
                "INSERT INTO attachments (id, user_id, created_at, kind, bucket_key, content_type, bytes, "
                "sha256, duration_s, detail_enc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (attachment_id, user["id"], now, kind, key, content_type, len(data),
                 hashlib.sha256(data).hexdigest(), duration_s,
                 crypto.enc_json(detail) if detail is not None else None))
    except Exception:
        bucket().delete(key)        # never leave an object nothing points at
        raise
    return recording_view({"id": attachment_id, "created_at": now, "kind": kind, "bytes": len(data),
                           "content_type": content_type, "duration_s": duration_s,
                           "detail_enc": crypto.enc_json(detail) if detail is not None else None})


def recording_view(row):
    return {"id": row["id"], "at": db.iso(row["created_at"]), "kind": row["kind"],
            "content_type": row["content_type"], "bytes": row["bytes"],
            "duration_s": round(row["duration_s"], 2) if row["duration_s"] is not None else None,
            "detail": crypto.dec_json(row["detail_enc"]) if row["detail_enc"] else None}


def list_recordings(user_id, limit=50):
    with db.connect() as conn:
        rows = conn.execute("SELECT * FROM attachments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                            (user_id, limit)).fetchall()
    return [recording_view(r) for r in rows]


def _row(conn, user_id, attachment_id):
    return conn.execute("SELECT * FROM attachments WHERE id = ? AND user_id = ?",
                        (attachment_id, user_id)).fetchone()


def load_recording(user_id, attachment_id):
    """(bytes, content_type, filename) for an owner or their counsellor, or None."""
    with db.connect() as conn:
        row = _row(conn, user_id, attachment_id)
    if row is None:
        return None
    data = bucket().get(row["bucket_key"])
    if hashlib.sha256(data).hexdigest() != row["sha256"]:
        raise StorageError("Stored recording failed its integrity check")
    return data, row["content_type"], os.path.basename(row["bucket_key"])


def delete_recording(user_id, attachment_id):
    with db.connect() as conn:
        row = _row(conn, user_id, attachment_id)
        if row is None:
            return False
        conn.execute("DELETE FROM attachments WHERE id = ?", (attachment_id,))
        key = row["bucket_key"]
    bucket().delete(key)
    return True


def delete_all_for_user(user_id):
    """Called when an account is erased: the rows cascade, the objects don't."""
    with db.connect() as conn:
        keys = [r["bucket_key"] for r in
                conn.execute("SELECT bucket_key FROM attachments WHERE user_id = ?", (user_id,))]
    try:
        bucket().delete_prefix(user_id)
    except StorageError:
        for key in keys:            # prefix delete unavailable: fall back to one by one
            try:
                bucket().delete(key)
            except StorageError:
                pass
    return len(keys)
