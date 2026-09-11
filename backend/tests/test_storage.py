"""Storage bucket: consent gating, encryption at rest, access control, deletion."""

import os
import sys
import tempfile
from pathlib import Path

os.environ["SAHAAS_DATA_DIR"] = tempfile.mkdtemp(prefix="sahaas-storage-test-")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np  # noqa: E402
import pytest  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from monitoring import api, auth, db, service, storage  # noqa: E402

db.init()
app = FastAPI()
app.include_router(api.router)
client = TestClient(app)

AUDIO = b"RIFF....fake wav payload for the bucket...."


@pytest.fixture(autouse=True)
def empty_db(tmp_path):
    storage.use_bucket(storage.LocalBucket(tmp_path / "bucket"))
    with db.connect() as conn:
        conn.execute("DELETE FROM users")
    yield


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def victim(recordings=True, name="Sunita"):
    v = service.register_victim(name, consent={"data_storage": True, "voice_analysis": True,
                                               "store_recordings": recordings})
    return v, auth.user_for_token(v["token"])


def save(user, data=AUDIO, **kwargs):
    return storage.save_recording(user, data, **kwargs)


# ---------------------------------------------------------------- consent

def test_nothing_is_stored_without_the_recordings_consent():
    _, user = victim(recordings=False)
    assert save(user) is None
    with db.connect() as conn:
        assert conn.execute("SELECT COUNT(*) FROM attachments").fetchone()[0] == 0


def test_consent_can_be_turned_on_later():
    v, user = victim(recordings=False)
    client.patch("/me/consent", json={"store_recordings": True}, headers=bearer(v["token"]))
    assert save(auth.user_for_token(v["token"])) is not None


def test_transcript_is_only_kept_in_the_detail_when_messages_are_stored():
    _, user = victim()
    saved = save(user, detail={"emotion": "sad", "transcript": "he shouted again"})
    assert saved["detail"]["transcript"] == "he shouted again"     # save_recording stores what it is given
    listed = storage.list_recordings(user["id"])[0]
    assert listed["detail"]["emotion"] == "sad"


# ---------------------------------------------------------------- at rest

def test_the_object_on_disk_is_encrypted_and_reads_back_intact():
    _, user = victim()
    saved = save(user)
    root = storage.bucket().root
    files = [p for p in root.rglob("*") if p.is_file()]
    assert len(files) == 1
    assert files[0].read_bytes() != AUDIO                 # ciphertext on disk
    assert b"fake wav payload" not in files[0].read_bytes()
    assert files[0].parent.name == user["id"]             # one folder per victim

    data, content_type, filename = storage.load_recording(user["id"], saved["id"])
    assert data == AUDIO and content_type == "audio/wav" and filename.endswith(".wav")


def test_a_tampered_object_is_refused():
    _, user = victim()
    saved = save(user)
    path = next(p for p in storage.bucket().root.rglob("*") if p.is_file())
    path.write_bytes(b"not the recording that was stored")
    with pytest.raises(Exception):
        storage.load_recording(user["id"], saved["id"])


def test_oversized_recordings_are_rejected():
    _, user = victim()
    with pytest.raises(storage.TooLarge):
        save(user, b"x" * (storage.MAX_UPLOAD_BYTES + 1))


def test_a_bucket_key_cannot_escape_the_bucket_directory():
    bucket = storage.bucket()
    with pytest.raises(storage.StorageError):
        bucket.put("../../escaped.wav", AUDIO)


def test_a_sibling_folder_sharing_the_prefix_is_outside_the_bucket():
    bucket = storage.bucket()                             # .../bucket
    with pytest.raises(storage.StorageError):
        bucket.put(f"../{bucket.root.name}-old/escaped.wav", AUDIO)


def test_wav_encoding_roundtrip():
    tone = np.sin(np.linspace(0, 40, 8000)).astype(np.float32)
    wav = storage.encode_wav(tone, 16000)
    assert wav[:4] == b"RIFF" and wav[8:12] == b"WAVE"
    _, user = victim()
    saved = save(user, wav, duration_s=0.5)
    assert storage.load_recording(user["id"], saved["id"])[0] == wav
    assert saved["duration_s"] == 0.5


# ---------------------------------------------------------------- access

def test_uploads_keep_their_own_type_and_extension():
    """main.py stores a voice note byte-for-byte under the type CONTENT_TYPES
    gives its extension, so .mp3 must not come back labelled as wav."""
    _, user = victim()
    for suffix, expected in ((".wav", "audio/wav"), (".mp3", "audio/mpeg")):
        assert storage.CONTENT_TYPES[suffix] == expected
        saved = save(user, AUDIO, kind="voice_note", content_type=expected, suffix=suffix)
        data, content_type, filename = storage.load_recording(user["id"], saved["id"])
        assert data == AUDIO and content_type == expected and filename.endswith(suffix)
    assert {r["kind"] for r in storage.list_recordings(user["id"])} == {"voice_note"}


def test_a_victim_sees_and_plays_only_their_own_recordings():
    v1, user1 = victim(name="Sunita")
    v2, user2 = victim(name="Meena")
    mine = save(user1)
    theirs = save(user2)

    listed = client.get("/me/recordings", headers=bearer(v1["token"])).json()
    assert [r["id"] for r in listed] == [mine["id"]]
    assert client.get(f"/me/recordings/{mine['id']}/audio", headers=bearer(v1["token"])).content == AUDIO
    assert client.get(f"/me/recordings/{theirs['id']}/audio", headers=bearer(v1["token"])).status_code == 404
    assert client.get("/me/recordings").status_code == 401


def test_audio_is_served_as_a_private_attachment():
    v, user = victim()
    saved = save(user)
    r = client.get(f"/me/recordings/{saved['id']}/audio", headers=bearer(v["token"]))
    assert r.headers["content-type"].startswith("audio/wav")
    assert "attachment" in r.headers["content-disposition"]
    assert "no-store" in r.headers["cache-control"]


def test_only_the_assigned_counsellor_can_reach_a_recording():
    mine = service.create_counsellor("Dr. Ananya")
    other = service.create_counsellor("Dr. Other")
    v, user = victim()                      # assigned to the counsellor with the smallest caseload
    saved = save(user)
    assigned = client.get("/me", headers=bearer(v["token"])).json()["counsellor"]
    owner, stranger = (mine, other) if assigned == "Dr. Ananya" else (other, mine)

    listed = client.get(f"/counsellor/victims/{user['id']}/recordings", headers=bearer(owner["token"]))
    assert [r["id"] for r in listed.json()] == [saved["id"]]
    audio = client.get(f"/counsellor/victims/{user['id']}/recordings/{saved['id']}/audio",
                       headers=bearer(owner["token"]))
    assert audio.content == AUDIO

    assert client.get(f"/counsellor/victims/{user['id']}/recordings",
                      headers=bearer(stranger["token"])).status_code == 404
    assert client.get(f"/counsellor/victims/{user['id']}/recordings/{saved['id']}/audio",
                      headers=bearer(stranger["token"])).status_code == 404
    assert client.get(f"/counsellor/victims/{user['id']}/recordings",
                      headers=bearer(v["token"])).status_code == 403


# ---------------------------------------------------------------- deletion

def test_deleting_a_recording_removes_the_object_too():
    v, user = victim()
    saved = save(user)
    assert client.delete(f"/me/recordings/{saved['id']}", headers=bearer(v["token"])).json() == {"deleted": True}
    assert client.get("/me/recordings", headers=bearer(v["token"])).json() == []
    assert not any(p.is_file() for p in storage.bucket().root.rglob("*"))
    assert client.delete(f"/me/recordings/{saved['id']}", headers=bearer(v["token"])).status_code == 404


def test_deleting_the_account_empties_the_bucket():
    v, user = victim()
    save(user)
    save(user, b"a second recording")
    assert client.delete("/me", headers=bearer(v["token"])).json() == {"deleted": True, "recordings_deleted": 2}
    assert not any(p.is_file() for p in storage.bucket().root.rglob("*"))
    with db.connect() as conn:
        assert conn.execute("SELECT COUNT(*) FROM attachments").fetchone()[0] == 0


def test_one_victims_deletion_leaves_another_alone():
    _, user1 = victim(name="Sunita")
    v2, user2 = victim(name="Meena")
    save(user1)
    kept = save(user2)
    storage.delete_all_for_user(user1["id"])
    assert storage.load_recording(user2["id"], kept["id"])[0] == AUDIO


def test_a_failed_insert_does_not_leave_an_orphaned_object(monkeypatch):
    _, user = victim()

    def boom(*args, **kwargs):
        raise RuntimeError("database went away")

    monkeypatch.setattr(storage.db, "connect", boom)
    with pytest.raises(RuntimeError):
        save(user)
    monkeypatch.undo()
    assert not any(p.is_file() for p in storage.bucket().root.rglob("*"))


# ---------------------------------------------------------------- config

def test_the_driver_is_chosen_by_env(monkeypatch):
    storage.use_bucket(None)
    monkeypatch.setenv("SAHAAS_STORAGE", "local")
    assert storage.bucket().name == "local"
    assert storage.status()["driver"] == "local"

    storage.use_bucket(None)
    monkeypatch.setenv("SAHAAS_STORAGE", "nonsense")
    with pytest.raises(storage.StorageError):
        storage.bucket()
    assert storage.status()["driver"] is None
    storage.use_bucket(None)
