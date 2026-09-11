"""Downloads the open, clearly licensed datasets the distress model trains on.

  ./train_distress.sh fetch            everything below (skips what's already here)
  ./train_distress.sh fetch --force    re-download
"""

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATASETS_DIR = HERE / "datasets"

SOURCES = {
    "av9ash/CSSR-S_labelled_suicidewatch_posts_reddit": "CC BY 4.0 - posts rated on the C-SSRS suicide-risk scale",
    "Ram07/Detection-for-Suicide": "MIT - 174k posts, suicide vs non-suicide",
    "hugginglearners/reddit-depression-cleaned": "CC0 - 7.7k posts, depression vs not",
    "google-research-datasets/go_emotions:simplified": "Apache-2.0 - 54k comments, 27 emotions",
    "Huzayfah-Patel/mindbridge-phq9-hindi-dialogues": "CC BY 4.0 - Hindi answers to PHQ-9/GAD-7 items, scored 0-3",
}


def fetch(spec, force=False):
    from datasets import load_dataset
    ds_id, _, config = spec.partition(":")
    out = DATASETS_DIR / ds_id.replace("/", "__")
    if not force and out.is_dir() and any(out.glob("*.jsonl")):
        print(f"  {ds_id}: already downloaded")
        return
    print(f"  {ds_id}: downloading ...")
    ds = load_dataset(ds_id, config or None)
    out.mkdir(parents=True, exist_ok=True)
    for split, part in ds.items():
        part.to_json(str(out / f"{split}.jsonl"), force_ascii=False)
        print(f"    {split}: {len(part)} rows")


if __name__ == "__main__":
    force = "--force" in sys.argv
    print("Distress datasets:")
    for spec, note in SOURCES.items():
        print(f"  - {spec.partition(':')[0]}: {note}")
    for spec in SOURCES:
        try:
            fetch(spec, force)
        except Exception as exc:
            print(f"  ! {spec}: {exc}")
