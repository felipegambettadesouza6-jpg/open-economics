"""Experimental, offline discovery evaluation.

This is intentionally not a runtime dependency. It compares a multilingual
embedding retriever and a lexical/embedding hybrid against the committed demand
benchmark, with thresholds selected on a deterministic calibration split and
reported on a disjoint holdout split.
"""

from __future__ import annotations

import json
import math
import re
import unicodedata
from pathlib import Path

import numpy as np
import torch
import transformers
from transformers.utils import import_utils

# Some Windows Python distributions ship a torchvision build incompatible with
# their torch build. Text-only embedding models do not need torchvision.
import_utils._torchvision_available = False
from transformers import AutoModel, AutoTokenizer


ROOT = Path(__file__).resolve().parents[1]
GENERATED = ROOT / "benchmarks" / "generated"
MODEL_ID = "intfloat/multilingual-e5-small"


def read_jsonl(path: Path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


catalog = json.loads((GENERATED / "current-v1-catalog.json").read_text(encoding="utf-8"))
concept_map = json.loads((ROOT / "benchmarks" / "current-v1-concept-map.json").read_text(encoding="utf-8"))
tasks = read_jsonl(GENERATED / "real-demand-v1.jsonl")
concepts = json.loads((GENERATED / "demand-concepts.json").read_text(encoding="utf-8"))


def passage(item):
    return "passage: " + ". ".join(
        [
            item["name"],
            item["official_name"],
            item["description"],
            item["category_name"],
            "Aliases: " + ", ".join(item["aliases"]),
        ]
    )


tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModel.from_pretrained(MODEL_ID)
model.eval()


def encode(texts, prefix, batch_size=32):
    vectors = []
    for start in range(0, len(texts), batch_size):
        batch = [prefix + text for text in texts[start : start + batch_size]]
        encoded = tokenizer(batch, max_length=192, padding=True, truncation=True, return_tensors="pt")
        with torch.no_grad():
            output = model(**encoded).last_hidden_state
        mask = encoded["attention_mask"].unsqueeze(-1).expand(output.size()).float()
        pooled = (output * mask).sum(1) / torch.clamp(mask.sum(1), min=1e-9)
        pooled = torch.nn.functional.normalize(pooled, p=2, dim=1)
        vectors.append(pooled.cpu().numpy())
    return np.concatenate(vectors, axis=0)


document_vectors = encode([passage(item).removeprefix("passage: ") for item in catalog], "passage: ")
query_vectors = encode([task["request"] for task in tasks], "query: ")
semantic_scores = query_vectors @ document_vectors.T


STOPWORDS = {
    "a", "ao", "as", "com", "como", "da", "das", "de", "desde", "do", "dos", "e", "em", "entre", "foi", "mais", "me", "no", "nos", "o", "os", "ou", "para", "pela", "pelas", "pelo", "pelos", "por", "qual", "quando", "que", "se", "sem", "uma", "um", "ultimo", "ultimos",
    "and", "as", "at", "by", "for", "from", "give", "has", "have", "how", "in", "is", "it", "last", "me", "of", "official", "over", "show", "since", "than", "that", "the", "this", "to", "versus", "what", "when", "which", "with", "year", "years",
}


def normalize(value):
    value = "".join(character for character in unicodedata.normalize("NFD", value) if unicodedata.category(character) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def content_tokens(value):
    return [token for token in normalize(value).split() if len(token) > 1 and token not in STOPWORDS]


lexical_scores = np.zeros_like(semantic_scores)
for task_index, task in enumerate(tasks):
    query_tokens = content_tokens(task["request"])
    for item_index, item in enumerate(catalog):
        primary = normalize(" ".join([item["id"], item["name"], item["official_name"], *item["aliases"]]))
        secondary = normalize(" ".join([item["description"], item["category"], item["category_name"], item["source_agency"]]))
        primary_tokens = set(primary.split())
        secondary_tokens = set(secondary.split())
        score = 0.0
        for token in query_tokens:
            if token in primary_tokens:
                score += 8
            elif token in primary:
                score += 5
            elif token in secondary_tokens:
                score += 3
            elif token in secondary:
                score += 1
        lexical_scores[task_index, item_index] = score

row_max = np.maximum(lexical_scores.max(axis=1, keepdims=True), 1)
normalized_lexical = lexical_scores / row_max
hybrid_scores = 0.72 * semantic_scores + 0.28 * normalized_lexical


def concept_passage(item):
    return ". ".join(
        [
            item["en"],
            item["pt"],
            item["domain"].replace("-", " "),
            "Dimensions: " + ", ".join(item["dimensions"]),
        ]
    )


concept_vectors = encode([concept_passage(item) for item in concepts], "passage: ")
concept_semantic_scores = query_vectors @ concept_vectors.T
concept_lexical_scores = np.zeros_like(concept_semantic_scores)
for task_index, task in enumerate(tasks):
    query_tokens = content_tokens(task["request"])
    for concept_index, item in enumerate(concepts):
        primary = normalize(" ".join([item["en"], item["pt"], item["domain"], *item["dimensions"]]))
        primary_tokens = set(primary.split())
        concept_lexical_scores[task_index, concept_index] = sum(
            8 if token in primary_tokens else 4 if token in primary else 0 for token in query_tokens
        )
concept_lexical_max = np.maximum(concept_lexical_scores.max(axis=1, keepdims=True), 1)
concept_hybrid_scores = 0.72 * concept_semantic_scores + 0.28 * (concept_lexical_scores / concept_lexical_max)


def is_covered(task):
    mapped = {concept for concepts in concept_map.values() for concept in concepts}
    return all(concept in mapped for concept in task["gold"]["concepts"])


def candidate_covers(item_index, task):
    mapped = set(concept_map.get(catalog[item_index]["id"], []))
    return all(concept in mapped for concept in task["gold"]["concepts"])


def metrics(scores, threshold, indexes):
    covered_weight = unsupported_weight = top1_weight = top3_weight = safe_weight = 0
    for index in indexes:
        task = tasks[index]
        weight = task["weight"]
        order = np.argsort(-scores[index])
        returned = [item_index for item_index in order if scores[index, item_index] >= threshold]
        covered = is_covered(task)
        if covered:
            covered_weight += weight
            if returned and candidate_covers(returned[0], task):
                top1_weight += weight
            if any(candidate_covers(item_index, task) for item_index in returned[:3]):
                top3_weight += weight
        else:
            unsupported_weight += weight
            if not returned:
                safe_weight += weight
    return {
        "top1_on_covered": top1_weight / covered_weight if covered_weight else 0,
        "top3_on_covered": top3_weight / covered_weight if covered_weight else 0,
        "safe_miss_on_unsupported": safe_weight / unsupported_weight if unsupported_weight else 0,
    }


calibration = [index for index in range(len(tasks)) if index % 5 == 0]
holdout = [index for index in range(len(tasks)) if index % 5 != 0]


def choose_threshold(scores):
    best = None
    for threshold in np.linspace(float(scores.min()), float(scores.max()), 160):
        result = metrics(scores, threshold, calibration)
        objective = math.sqrt(result["top1_on_covered"] * result["safe_miss_on_unsupported"])
        candidate = (objective, float(threshold), result)
        if best is None or candidate[0] > best[0]:
            best = candidate
    return best


report = {"model": MODEL_ID, "calibration_tasks": len(calibration), "holdout_tasks": len(holdout), "engines": {}}
for name, scores in [("multilingual_embedding", semantic_scores), ("hybrid_embedding_lexical", hybrid_scores)]:
    objective, threshold, calibration_result = choose_threshold(scores)
    report["engines"][name] = {
        "selected_threshold": threshold,
        "calibration_objective": objective,
        "calibration": calibration_result,
        "holdout": metrics(scores, threshold, holdout),
    }


def concept_metrics(scores, indexes):
    top1_weight = top3_weight = total_weight = 0
    for index in indexes:
        gold = set(tasks[index]["gold"]["concepts"])
        order = np.argsort(-scores[index])
        top1 = {concepts[order[0]]["id"]}
        top3 = {concepts[item]["id"] for item in order[: max(3, len(gold))]}
        weight = tasks[index]["weight"]
        total_weight += weight
        if gold.issubset(top1):
            top1_weight += weight
        if gold.issubset(top3):
            top3_weight += weight
    return {"top1": top1_weight / total_weight, "top3": top3_weight / total_weight}


discovery_holdout = [index for index, task in enumerate(tasks) if task["workflow"] == "discovery-holdout"]
report["concept_router"] = {}
for name, scores in [
    ("multilingual_embedding", concept_semantic_scores),
    ("hybrid_embedding_lexical", concept_hybrid_scores),
]:
    report["concept_router"][name] = {
        "all_tasks": concept_metrics(scores, range(len(tasks))),
        "manual_discovery_holdout": concept_metrics(scores, discovery_holdout),
    }

(GENERATED / "embedding-experiment.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2, ensure_ascii=False))
