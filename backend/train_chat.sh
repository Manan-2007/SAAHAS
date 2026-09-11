#!/bin/bash
# Fine-tunes the SAHAAS chat model on everything in chat_training/datasets/.
#   ./train_chat.sh fetch            download the recommended open datasets
#   ./train_chat.sh                  prepare data + train + compare replies
#   ./train_chat.sh --quick          20-iteration smoke test
#   ./train_chat.sh --resume         keep training the current adapter
#   ./train_chat.sh revert           go back to the untrained model (keeps a copy)
set -e
cd "$(dirname "$0")"

if [ "$1" = "revert" ]; then
    if [ -d chat_training/adapters ]; then
        rm -rf chat_training/adapters_disabled
        mv chat_training/adapters chat_training/adapters_disabled
        echo "Adapter disabled (moved to chat_training/adapters_disabled). The backend uses the base model from the next message."
    else
        echo "No trained adapter is active - already using the base model."
    fi
    exit 0
fi

if [ "$(uname)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ]; then
    echo "Chat training uses MLX and needs an Apple Silicon Mac."
    exit 1
fi
if [ ! -x venv/bin/python ]; then
    echo "No backend virtual environment yet - run ./start.sh (or ../start.sh) once first."
    exit 1
fi
./venv/bin/python -c "import mlx_lm, datasets" 2>/dev/null || ./venv/bin/pip install "mlx-lm>=0.31" datasets

if [ "$1" = "fetch" ]; then
    shift
    exec ./venv/bin/python chat_training/fetch.py "$@"
fi
exec ./venv/bin/python chat_training/train.py "$@"
