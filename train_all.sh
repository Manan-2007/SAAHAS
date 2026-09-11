#!/bin/bash
# Downloads the data and trains SAHAAS's models in one go.
#   ./train_all.sh              distress model (downloads data first)
#   ./train_all.sh --with-chat  ...then also fine-tune the chat model (~75 min more)
#   ./train_all.sh --quick      fast smoke test of everything selected
set -e
cd "$(dirname "$0")/backend"

WITH_CHAT=0
PASS=()
for arg in "$@"; do
    case "$arg" in
        --with-chat) WITH_CHAT=1 ;;
        *) PASS+=("$arg") ;;
    esac
done

echo "=== 1/2 Distress model: fetching data"
./train_distress.sh fetch
echo "=== 1/2 Distress model: training"
./train_distress.sh ${PASS[@]+"${PASS[@]}"}

if [ "$WITH_CHAT" = 1 ]; then
    echo "=== 2/2 Chat model: fetching data"
    ./train_chat.sh fetch
    echo "=== 2/2 Chat model: training"
    ./train_chat.sh ${PASS[@]+"${PASS[@]}"}
else
    echo "=== 2/2 Chat model: skipped (add --with-chat)."
    echo "    On the public datasets, fine-tuning made chat replies worse than the base model"
    echo "    + system prompt. Train it once you have your own counsellor-reviewed conversations."
fi

echo
echo "All done. A running backend picks up the new models on the next message - no restart needed."
