#!/bin/bash
# Trains the SAHAAS distress model (message -> distress level 0-3).
#   ./train_distress.sh fetch      download the open datasets
#   ./train_distress.sh            prepare + train + evaluate
#   ./train_distress.sh --quick    small smoke test (a few minutes)
set -e
cd "$(dirname "$0")"

if [ ! -x venv/bin/python ]; then
    echo "No backend virtual environment yet - run ./start.sh (or ../start.sh) once first."
    exit 1
fi
./venv/bin/python -c "import datasets, sklearn" 2>/dev/null || ./venv/bin/pip install datasets scikit-learn

# Cap how much memory PyTorch may take on the Mac GPU (shared with system RAM)
# and make it hand cached memory back, so training doesn't push the Mac into swap.
if [ "$1" = "fetch" ]; then
    shift
    exec ./venv/bin/python distress_training/fetch.py "$@"
fi
exec ./venv/bin/python distress_training/train.py "$@"
