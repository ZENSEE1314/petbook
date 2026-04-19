"""LLM-backed helpers for admin tools.

Calls Ollama Cloud when OLLAMA_API_KEY is set (hosted, no local GPU needed).
Falls back to Anthropic if ANTHROPIC_API_KEY is set, then to a canned template
so the app works offline. Returns rich info dict so the admin UI can show why
a fallback was used.
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
  - sexing: how owners can tell a male from a female (visual markers, vent/cloaca check,
    behaviour, age at which the difference becomes visible).
  - breeding_guide: practical breeding guidance — pairing age, environment prep,
    conditioning, nesting, gestation/incubation, weaning / separation, and any legal /
    ethical considerations for that species.
  - breeding_frequency: typical number of breedings per year (e.g. "1-2 litters per year",
    "spring only").
  - litter_size: typical number of offspring per successful breeding (e.g. "4-6 kits",
    "100-200 eggs").
Keep each text field under 1200 characters. Respond with JSON only, no prose."""

_ANIMAL_SYSTEM = """You are a pet-ownership expert. Given a count, list that many distinct species
commonly kept as pets that a user might not already have. Output JSON only:
[{"name": "...", "category": "mammal|bird|reptile|fish|amphibian|invertebrate", "short_description": "..."}]."""


# ---------- Canned fallback ----------


def _canned_guide(animal_name: str) -> dict[str, str]:
    return {
        "story": f"Edit me — 2-4 sentence overview of the {animal_name}: history, why people keep them, what makes them special.",
        "origin": f"Edit me — where {animal_name}s come from (region / country / breed origin).",
        "temperament": "Edit me — personality, social needs, activity level.",
        "colors": "Edit me — common colour variations and coat / feather / scale types.",
        "lifespan_years": "Edit me — typical lifespan range in years",
        "weight_range": "Edit me — adult weight range with units (e.g. 2-4 kg)",
        "length_range": "Edit me — adult length or height range (e.g. 30-40 cm)",
        "adult_size": f"Edit me — fully grown size summary for a {animal_name}",
        "healthy_markers": "Bright eyes, clean coat/feathers/scales, steady weight, active and alert.",
        "diet": "Edit me — species-appropriate diet, portion guidance, feeding schedule.",
        "training": "Edit me — how to train them and when to start.",
        "housing": "Edit me — enclosure, space, environment, temperature/humidity.",
        "common_issues": "Edit me — common illnesses, injuries, behavioural problems and prevention.",
        "sexing": "Edit me — how to tell a male from a female (visual cues, behaviour, age when visible).",
        "breeding_guide": "Edit me — breeding practices: pairing age, environment, gestation/incubation, weaning.",
        "breeding_frequency": "Edit me — e.g. 1-2 times per year",
        "litter_size": "Edit me — e.g. 4-6 per litter",
        "age_stages": json.dumps(
            [
                {"stage": "newborn", "age_range": "0-? weeks", "size": "edit me", "feeding": "edit me", "milestones": "edit me", "notes": "edit me"},
                {"stage": "juvenile", "age_range": "? weeks - ? months", "size": "edit me", "feeding": "edit me", "milestones": "edit me", "notes": "edit me"},
                {"stage": "adolescent", "age_range": "? - ? months", "size": "edit me", "feeding": "edit me", "milestones": "edit me", "notes": "edit me"},
                {"stage": "adult", "age_range": "? - ? years", "size": "edit me", "feeding": "edit me", "milestones": "edit me", "notes": "edit me"},
                {"stage": "senior", "age_range": "?+ years", "size": "edit me", "feeding": "edit me", "milestones": "edit me", "notes": "edit me"},
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


class AiResult:
    """Wrapper so callers know which backend produced the data (or why none did)."""

    def __init__(self, data: dict | list, source: str, error: str | None = None):
        self.data = data
        self.source = source  # "ollama" | "anthropic" | "canned"
        self.error = error


# ---------- Ollama Cloud ----------


def _ollama_chat(system: str, user: str) -> tuple[str | None, str | None]:
    """POST /api/chat to Ollama Cloud. Returns (content, error)."""
    if not settings.ollama_api_key:
        return None, "OLLAMA_API_KEY not set"
    url = f"{settings.ollama_host.rstrip('/')}/api/chat"
    payload = {
        "model": settings.ollama_model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "stream": False,
    }
    headers = {"Authorization": f"Bearer {settings.ollama_api_key}"}
    try:
        resp = httpx.post(url, json=payload, headers=headers, timeout=120.0)
    except httpx.HTTPError as exc:
        return None, f"Ollama network error: {exc}"
    if resp.status_code != 200:
        snippet = resp.text[:300].replace("\n", " ")
        return None, f"Ollama HTTP {resp.status_code}: {snippet}"
    try:
        data = resp.json()
    except ValueError:
        return None, f"Ollama non-JSON response: {resp.text[:300]}"
    content = (data.get("message") or {}).get("content")
    if not content:
        return None, f"Ollama empty content: {json.dumps(data)[:300]}"
    return content, None


# ---------- Anthropic (legacy fallback) ----------


def _anthropic_chat(system: str, user: str) -> tuple[str | None, str | None]:
    if not settings.anthropic_api_key:
        return None, "ANTHROPIC_API_KEY not set"
    try:
        import anthropic
    except ImportError:
        return None, "anthropic package missing"
    try:
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(block.text for block in msg.content if hasattr(block, "text"))
        if not text:
            return None, "Anthropic returned empty text"
        return text, None
    except Exception as exc:  # noqa: BLE001
        return None, f"Anthropic error: {exc}"


# ---------- Helpers ----------


def _parse_json_loose(text: str) -> Any | None:
    """Some models wrap JSON in markdown fences. Strip and parse."""
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        if stripped.startswith("json"):
            stripped = stripped[4:]
        stripped = stripped.strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        return None


# ---------- Public API ----------


def generate_guide_draft(animal_name: str) -> AiResult:
    user_msg = f"Species: {animal_name}"
    errors: list[str] = []

    text, err = _ollama_chat(_GUIDE_SYSTEM, user_msg)
    if err:
        errors.append(f"ollama: {err}")
    if text:
        parsed = _parse_json_loose(text)
        if isinstance(parsed, dict):
            return AiResult(
                {k: (v if isinstance(v, str) else json.dumps(v)) for k, v in parsed.items()},
                "ollama",
            )
        errors.append(f"ollama: non-JSON body: {text[:200]}")

    text, err = _anthropic_chat(_GUIDE_SYSTEM, user_msg)
    if err:
        errors.append(f"anthropic: {err}")
    if text:
        parsed = _parse_json_loose(text)
        if isinstance(parsed, dict):
            return AiResult(
                {k: (v if isinstance(v, str) else json.dumps(v)) for k, v in parsed.items()},
                "anthropic",
            )
        errors.append(f"anthropic: non-JSON body: {text[:200]}")

    return AiResult(_canned_guide(animal_name), "canned", " | ".join(errors) or None)


def suggest_more_animals(count: int = 5, exclude_names: list[str] | None = None) -> AiResult:
    exclude_names = exclude_names or []
    user_msg = f"Suggest {count} species. Exclude: {', '.join(exclude_names) or 'none'}."
    errors: list[str] = []

    text, err = _ollama_chat(_ANIMAL_SYSTEM, user_msg)
    if err:
        errors.append(f"ollama: {err}")
    if text:
        parsed = _parse_json_loose(text)
        if isinstance(parsed, list):
            return AiResult(parsed, "ollama")
        errors.append(f"ollama: non-JSON body: {text[:200]}")

    text, err = _anthropic_chat(_ANIMAL_SYSTEM, user_msg)
    if err:
        errors.append(f"anthropic: {err}")
    if text:
        parsed = _parse_json_loose(text)
        if isinstance(parsed, list):
            return AiResult(parsed, "anthropic")
        errors.append(f"anthropic: non-JSON body: {text[:200]}")

    fallback = [a for a in _CANNED_ANIMALS if a["name"] not in exclude_names][:count]
    return AiResult(fallback, "canned", " | ".join(errors) or None)
