# scripts/indic_translation.py
"""
IndicTrans2 translation utilities used in mapping pipeline.
- Loads local HF model once
- Simple script-based language detection → IndicTrans2 tags
- Batch-friendly translate(src->tgt)

Notes:
- Keep generation conservative for terminology translation
- Disable kv cache to avoid KeyError seen with some custom configs
"""
from __future__ import annotations

from typing import List

import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM


# Default local model path (adjust if needed)
DEFAULT_CKPT_DIR = "c:/Users/rishr/sih026/indictrans2-indic-en-1B"


class IndicTranslator:
    def __init__(self, ckpt_dir: str = DEFAULT_CKPT_DIR, device: 'str | None' = None):
        # Support Python <3.10 by allowing string-annotated union; value handling remains the same
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(ckpt_dir, trust_remote_code=True)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(ckpt_dir, trust_remote_code=True)
        # Use fp16 on CUDA to speed up and reduce memory
        if self.device == "cuda":
            try:
                self.model.half()
            except Exception:
                pass
        self.model.to(self.device)
        self.model.eval()
        # Avoid cache-related issues
        try:
            self.model.config.use_cache = False
        except Exception:
            pass

    def translate(self, text: str, src_lang: str, tgt_lang: str, max_length: int = 128) -> str:
        if not text:
            return ""
        prompt = f"{src_lang} {tgt_lang} {text}".strip()
        enc = self.tokenizer([prompt], return_tensors="pt", padding=True, truncation=True, max_length=256).to(self.device)
        # Fast, deterministic-ish generation for terminology
        with torch.inference_mode():
            gen = self.model.generate(
                **enc,
                max_new_tokens=64,
                num_beams=1,  # speed
                do_sample=False,
                use_cache=False,
                length_penalty=1.0,
                early_stopping=True,
            )
        out = self.tokenizer.batch_decode(gen, skip_special_tokens=True)
        return out[0].strip() if out else ""

    def batch_translate(self, texts: List[str], src_lang: str, tgt_lang: str, max_length: int = 128, batch_size: int = 16) -> List[str]:
        if not texts:
            return []
        outs_all: List[str] = []
        for i in range(0, len(texts), batch_size):
            chunk = texts[i:i+batch_size]
            prompts = [f"{src_lang} {tgt_lang} {t}".strip() if t else "" for t in chunk]
            enc = self.tokenizer(prompts, return_tensors="pt", padding=True, truncation=True, max_length=256).to(self.device)
            with torch.inference_mode():
                gen = self.model.generate(
                    **enc,
                    max_new_tokens=64,
                    num_beams=1,  # speed
                    do_sample=False,
                    use_cache=False,
                    length_penalty=1.0,
                    early_stopping=True,
                )
            outs = self.tokenizer.batch_decode(gen, skip_special_tokens=True)
            outs_all.extend([o.strip() for o in outs])
        return outs_all


# --- Language tag detection ---
# Map key Unicode ranges → IndicTrans2 tags
# This is a heuristic; extend as needed for your data.
SCRIPT_TAGS = [
    (range(0x0900, 0x0980), "hin_Deva"),  # Devanagari: Hindi/Marathi/Sanskrit
    (range(0x0980, 0x0A00), "ben_Beng"),  # Bengali
    (range(0x0A00, 0x0A80), "pan_Guru"),  # Gurmukhi (Punjabi)
    (range(0x0A80, 0x0B00), "guj_Gujr"),  # Gujarati
    (range(0x0B00, 0x0B80), "ory_Orya"),  # Odia
    (range(0x0B80, 0x0C00), "tam_Taml"),  # Tamil
    (range(0x0C00, 0x0C80), "tel_Telu"),  # Telugu
    (range(0x0C80, 0x0D00), "kan_Knda"),  # Kannada
    (range(0x0D00, 0x0D80), "mal_Mlym"),  # Malayalam
    (range(0x0600, 0x0780), "urd_Arab"),  # Arabic range (Urdu)
]


def detect_lang_tag(text: str) -> str:
    if not text:
        return "eng_Latn"
    for ch in text:
        cp = ord(ch)
        for rng, tag in SCRIPT_TAGS:
            if cp in rng:
                return tag
        # early exit for A-Z / a-z as Latin
        if (65 <= cp <= 90) or (97 <= cp <= 122):
            return "eng_Latn"
    # Fallback
    return "eng_Latn"