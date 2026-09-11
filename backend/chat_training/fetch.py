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

# Dropped on purpose: thu-coai/esconv (CC BY-NC, and annotated with counselling
# strategies) and ShenLab/MentalChat16K (counselling transcripts). Between them
# they were 10.6k of 15k examples and the main source of the "breathing /
# not alone" register. SAHAAS is meant to talk, not counsel.
RECOMMENDED = {

    "Estwld/empathetic_dialogues_llm": "Apache-2.0 tag, derived from EmpatheticDialogues (CC BY-NC) - ~25k empathetic chats",

    "heliosbrahma/mental_health_chatbot_dataset": "MIT - small mental-health Q&A set",
    # Everyday talk, so replies to "hi" or "what did you eat" sound like a person
    # instead of a counsellor. Also the one gap live translation cannot cover:
    # Hinglish is romanized, and opus-mt-hi-en expects Devanagari.
    "Abhishekcr448/Hinglish-Everyday-Conversations-1M": "MIT - 1M short everyday Hinglish exchanges",
    "ZahrizhalAli/mental_health_conversational_dataset": "MIT - English mental-health conversations",
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
