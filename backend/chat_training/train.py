"""Prepares the dropped datasets, LoRA fine-tunes the chat model with mlx-lm,
then prints sample replies so you can hear how it sounds.

Run via ../train_chat.sh:
  ./train_chat.sh                # full run (iters from config.yaml)
  ./train_chat.sh --quick        # 20-iteration smoke test
  ./train_chat.sh --iters 2000   # override iterations
  ./train_chat.sh --resume       # continue training the current adapter
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

import prepare

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

PROBES = [
    "I can't stop shaking. My court hearing is tomorrow and I keep thinking I'll freeze.",
    "Sometimes I feel like nobody believes what happened to me.",
    "I don't really know why I'm here. I just feel numb.",
]


def publish(staging, adapter_dir):
    """Swap the finished adapter in atomically so the running backend
    reloads it exactly once, never mid-training."""
    adapter_dir.mkdir(exist_ok=True)
    shutil.copy2(staging / "adapter_config.json", adapter_dir / "adapter_config.json")
    tmp = adapter_dir / "adapters.safetensors.tmp"
    shutil.copy2(staging / "adapters.safetensors", tmp)
    os.replace(tmp, adapter_dir / "adapters.safetensors")


def sample(cfg):
    """Side-by-side replies: lower loss only means the model sounds more like
    the datasets, which is not the same as being a better companion."""
    from chat_engine import ChatModel
    cfg = {**cfg, "generation": {**cfg.get("generation", {}), "temperature": 0.0}}
    replies = {}
    for label, use_adapter in (("untrained", False), ("trained", True)):
        model = ChatModel(cfg, use_adapter=use_adapter)
        replies[label] = [model.reply([{"role": "user", "content": p}])["reply"] for p in PROBES]
        del model
    for i, probe in enumerate(PROBES):
        print(f"\n  > {probe}")
        print(f"    untrained: {replies['untrained'][i]}")
        print(f"    trained:   {replies['trained'][i]}")
    print("\nIf the trained replies aren't clearly better, run `./train_chat.sh revert` "
          "to go back to the untrained model.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--iters", type=int, help="training iterations (default: config.yaml)")
    ap.add_argument("--quick", action="store_true", help="20-iteration smoke test")
    ap.add_argument("--resume", action="store_true", help="continue from the current adapter")
    ap.add_argument("--skip-prepare", action="store_true", help="reuse data/ from the last run")
    args = ap.parse_args()

    cfg = prepare.load_config()
    t = cfg["training"]
    if not args.skip_prepare:
        print("Preparing datasets ...")
        prepare.run(cfg)

    adapter_dir = HERE / cfg.get("adapter_path", "adapters")
    staging = HERE / "adapters_training"
    iters = 20 if args.quick else (args.iters or t["iters"])
    val_batches = 5 if args.quick else t.get("val_batches", 10)

    lora_cfg = {
        "model": cfg["base_model"],
        "train": True,
        "data": str(prepare.DATA_DIR),
        "fine_tune_type": "lora",
        "mask_prompt": True,
        "iters": iters,
        "batch_size": t["batch_size"],
        "learning_rate": float(t["learning_rate"]),
        "num_layers": t["num_layers"],
        "max_seq_length": t["max_seq_length"],
        "grad_checkpoint": bool(t.get("grad_checkpoint", True)),
        "steps_per_eval": min(t["steps_per_eval"], iters),
        "save_every": min(t["save_every"], iters),
        "val_batches": val_batches,
        "adapter_path": str(staging),
        "lora_parameters": {"rank": t["lora_rank"], "dropout": t["lora_dropout"], "scale": t["lora_scale"]},
    }
    current = adapter_dir / "adapters.safetensors"
    if args.resume and current.is_file():
        lora_cfg["resume_adapter_file"] = str(current)

    cfg_path = prepare.DATA_DIR / "lora_config.yaml"
    cfg_path.write_text(yaml.safe_dump(lora_cfg, sort_keys=False))
    print(f"\nTraining {cfg['base_model']} for {iters} iterations "
          f"(first run downloads the base model if it isn't cached) ...\n")
    subprocess.run([sys.executable, str(HERE / "lora_entry.py"), "-c", str(cfg_path)], check=True)

    publish(staging, adapter_dir)
    print(f"\nAdapter saved to {adapter_dir}. A running backend picks it up on the next chat message.")
    sample(cfg)


if __name__ == "__main__":
    main()
