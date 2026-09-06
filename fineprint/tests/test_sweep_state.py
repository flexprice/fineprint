"""The sweep's results must actually reach the bucket.

store.upload(src, obj) takes (source, object) — the reverse of download(obj, dest) — and returns
silently when the source path does not exist. Calling it backwards therefore prints success and
uploads nothing, which would quietly discard an entire multi-hour sweep.
"""
from pathlib import Path

from fineprint import sweep


def test_sync_up_uploads_each_state_file_source_first(tmp_path, monkeypatch):
    runs = tmp_path / "runs.json"
    runs.write_text("{}")
    monkeypatch.setattr(sweep, "_STATE", {"state/runs.json": runs})
    monkeypatch.setattr(sweep.store, "enabled", lambda: True)
    seen = []
    monkeypatch.setattr(sweep.store, "upload", lambda src, obj: seen.append((str(src), obj)))

    sweep._sync_up()

    assert seen == [(str(runs), "state/runs.json")], "arguments are reversed — nothing would upload"


def test_sync_up_skips_files_that_do_not_exist(tmp_path, monkeypatch):
    monkeypatch.setattr(sweep, "_STATE", {"state/gone.json": tmp_path / "gone.json"})
    monkeypatch.setattr(sweep.store, "enabled", lambda: True)
    seen = []
    monkeypatch.setattr(sweep.store, "upload", lambda src, obj: seen.append(obj))
    sweep._sync_up()
    assert seen == []
