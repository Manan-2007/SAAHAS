"""Downloads emotional-support datasets from Hugging Face into datasets/.

  ./train_chat.sh fetch                      # the recommended open set below
  ./train_chat.sh fetch <owner/dataset> ...  # any Hugging Face dataset

Check each dataset's license before using a model trained on it
commercially - several are non-commercial (CC BY-NC).
"""

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATASETS_DIR = HERE / "datasets"

RECOMMENDED = {
    "ShenLab/MentalChat16K": "MIT - ~16k mental-health counselling conversations",
    "Estwld/empathetic_dialogues_llm": "Apache-2.0 tag, derived from EmpatheticDialogues (CC BY-NC) - ~25k empathetic chats",
    "thu-coai/esconv": "CC BY-NC 4.0 - ~1.3k long emotional-support dialogs with counselling strategies",
    "heliosbrahma/mental_health_chatbot_dataset": "MIT - small mental-health Q&A set",
}


def fetch(dataset_id):
    from datasets import load_dataset
    print(f"Fetching {dataset_id} ...")
    try:
        ds = load_dataset(dataset_id)
    except Exception as exc:
        print(f"  could not fetch {dataset_id}: {exc}\n"
              f"  Gated dataset? Accept its terms on huggingface.co/datasets/{dataset_id}, "
              f"then run `./venv/bin/hf auth login` and retry.")
        return
    out = DATASETS_DIR / dataset_id.replace("/", "__")
    out.mkdir(parents=True, exist_ok=True)
    for split, part in ds.items():
        part.to_json(str(out / f"{split}.jsonl"), force_ascii=False)
        print(f"  {split}: {len(part)} rows -> {out.relative_to(HERE)}/{split}.jsonl")


if __name__ == "__main__":
    ids = sys.argv[1:] or list(RECOMMENDED)
    if not sys.argv[1:]:
        for i, note in RECOMMENDED.items():
            print(f"  {i}: {note}")
    for dataset_id in ids:
        fetch(dataset_id)
