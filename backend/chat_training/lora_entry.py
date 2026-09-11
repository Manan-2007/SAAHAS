"""mlx-lm LoRA training with one fix applied.

Qwen3 chat templates render an empty "<think>\\n\\n</think>\\n\\n" block before
the final assistant reply of a conversation, but at inference the generation
prompt stops at "<|im_start|>assistant\\n" and the model answers directly.
Training on that block makes the first steps learn tokens the model never
uses live (base loss ~5.3 instead of ~2.5) and derails its replies. Stripping
it makes every training example look exactly like a live chat turn.
"""

from mlx_lm import lora
from mlx_lm.tuner import datasets

EMPTY_THINK = "<think>\n\n</think>\n\n"


def process(self, d):
    tok = self.tokenizer
    messages = d[self.chat_key]
    text = tok.apply_chat_template(messages, tokenize=False).replace(EMPTY_THINK, "")
    tokens = tok.encode(text, add_special_tokens=False)
    if not self.mask_prompt:
        return (tokens, 0)
    prompt = tok.apply_chat_template(messages[:-1], tokenize=False,
                                     add_generation_prompt=True).replace(EMPTY_THINK, "")
    return (tokens, len(tok.encode(prompt, add_special_tokens=False)))


datasets.ChatDataset.process = process

if __name__ == "__main__":
    lora.main()
