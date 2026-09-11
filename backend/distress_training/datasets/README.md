# Drop distress datasets here

`./train_distress.sh fetch` downloads the open datasets into this folder.
Each public dataset has a label mapping in `../prepare.py`.

**Your own data** (the most valuable addition, e.g. counsellor-rated SAHAAS
messages in Hindi/Punjabi/English): put `.jsonl` or `.csv` files in a new
folder here, with two fields per row:

| field | value |
|---|---|
| `text` | the message |
| `level` | `0` none · `1` low (stress, sadness, worry) · `2` moderate (depression, hopelessness, passive wish to be dead) · `3` high (suicidal thoughts, plan, attempt) |

```json
{"text": "मुझे अब किसी चीज़ में मन नहीं लगता", "level": 2}
```

Contents here are git-ignored.
