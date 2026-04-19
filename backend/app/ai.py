"""LLM-backed helpers for admin tools.

Calls Ollama Cloud when OLLAMA_API_KEY is set (hosted, no local GPU needed).
Falls back to Anthropic if ANTHROPIC_API_KEY is set, then to a canned template
so the app works offline.
"""

from __future__ import annotations

import json
from typing import Any

import httpx

from .config import settings

_GUIDE_SYSTEM = """You are a veterinary care writer. Given a pet species, output a rich JSON
object with these string fields:
  - story: 2-4 sentence overview covering history, why people keep them, and what makes them
    special.
  - origin: where the species comes from (region / country / breed origin).
  - temperament: personality, social needs, activity level (2-3 sentences).
  - colors: common colour variations and coat/feather/scale types.
  - lifespan_years: typical range e.g. "10-15".
  - weight_range: adult weight range with units e.g. "2-4 kg".
  - length_range: adult length/height range with units e.g. "30-40 cm".
  - adult_size: short summary of fully grown size.
  - healthy_markers: signs of good health to look for.
  - diet: species-appropriate diet, portion guidance, feeding schedule.
  - training: how to train them, recommended approach, age to start.
  - housing: enclosure, space, environment, temperature/humidity if applicable.
  - common_issues: common illnesses, injuries, behavioural problems and prevention.
  - age_stages: JSON ARRAY (as a string) of objects with keys {stage, age_range, size,
    feeding, milestones, notes}. Cover at minimum: newborn, juvenile, adolescent, adult,
    senior. Each milestone field should mention what owners can expect at that stage and
    how care changes.
Keep each text field under 1200 characters. Respond with JSON only, no prose."""

_ANIMAL_SYSTEM = """You are a pet-ownership expert. Given a count, list that many distinct species
commonly kept as pets that a user might not already have. Output JSON only:
[{"name": "...", "category": "mammal|bird|reptile|fish|amphibian|invertebrate", "short_description": "..."}]."""


# ---------- Canned fallback ----------


def _canned_guide(animal_name: str) -> dict[str, str]:
    return {
        "lifespan_years": "Edit me — typical lifespan range",
        "adult_size": f"Edit me — adult size for {animal_name}",
        "healthy_markers": "Bright eyes, clean coat/feathers/scales, steady weight, active and alert.",
        "diet": "Edit me — species-appropriate diet and feeding schedule.",
        "training": "Edit me — basic training approach.",
        "housing": "Edit me — enclosure size and environmental needs.",
        "common_issues": "Edit me — common health issues and prevention.",
        "age_stages": json.dumps(
            [
                {"stage": "juvenile", "age_range": "0-?", "size": "?", "feeding": "?", "notes": "?"},
                {"stage": "adult", "age_range": "?-?", "size": "?", "feeding": "?", "notes": "?"},
                {"stage": "senior", "age_range": "?+", "size": "?", "feeding": "?", "notes": "?"},
            ]
        ),
    }


_CANNED_ANIMALS = [
    {"name": "Axolotl", "category": "amphibian", "short_description": "Aquatic salamander that stays in larval form."},
    {"name": "Ferret", "category": "mammal", "short_description": "Playful, highly social mustelid."},
    {"name": "Hedgehog", "category": "mammal", "short_description": "Spiny insectivore, mostly nocturnal."},
    {"name": "Leopard Gecko", "category": "reptile", "short_description": "Docile, beginner-friendly lizard."},
    {"name": "Betta Fish", "category": "fish", "short_description": "Vibrant freshwater fighter fish."},
    {"name": "Cockatiel", "category": "bird", "short_description": "Affectionate small parrot with a crest."},
    {"name": "Guinea Pig", "category": "mammal", "short_description": "Social, vocal rodent."},
    {"name": "Rabbit", "category": "mammal", "short_description": "Intelligent lagomorph, litter-trainable."},
]


# ---------- Ollama Cloud ----------


def _ollama_chat(system: str, user: str) -> str | None:
    """POST /api/chat to Ollama Cloud. Returns the model's raw text response, or None on failure."""
    if not settings.ollama_api_key:
        return None
    url = f"{settings.ollama_host.rstrip('/')}/api/chat"
    payload = {
        "model": settings.ollama_model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "stream": False,
        "format": "json",
    }
    headers = {"Authorization": f"Bearer {settings.ollama_api_key}"}
    try:
        resp = httpx.post(url, json=payload, headers=headers, timeout=120.0)
        resp.raise_for_status()
        data = resp.json()
        return data.get("message", {}).get("content")
    except (httpx.HTTPError, ValueError):
        return None


# ---------- Anthropic (legacy fallback) ----------


def _anthropic_chat(system: str, user: str) -> str | None:
    if not settings.anthropic_api_key:
        return None
    try:
        import anthropic  # lazy import
    except ImportError:
        return None
    try:
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return "".join(block.text for block in msg.content if hasattr(block, "text"))
    except Exception:  # noqa: BLE001 — any network/auth failure falls back to canned
        return None


# ---------- Public API ----------


def generate_guide_draft(animal_name: str) -> dict[str, str]:
    text = _ollama_chat(_GUIDE_SYSTEM, f"Species: {animal_name}") or _anthropic_chat(
        _GUIDE_SYSTEM, f"Species: {animal_name}"
    )
    if not text:
        return _canned_guide(animal_name)
    try:
        data: dict[str, Any] = json.loads(text)
    except json.JSONDecodeError:
        return _canned_guide(animal_name)
    return {k: (v if isinstance(v, str) else json.dumps(v)) for k, v in data.items()}


def suggest_more_animals(count: int = 5, exclude_names: list[str] | None = None) -> list[dict[str, str]]:
    exclude_names = exclude_names or []
    user_msg = f"Suggest {count} species. Exclude: {', '.join(exclude_names) or 'none'}."
    text = _ollama_chat(_ANIMAL_SYSTEM, user_msg) or _anthropic_chat(_ANIMAL_SYSTEM, user_msg)
    if not text:
        return [a for a in _CANNED_ANIMALS if a["name"] not in exclude_names][:count]
    try:
        data = json.loads(text)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []
