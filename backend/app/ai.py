"""LLM-backed helpers for admin tools.

Used when admin clicks "generate guide draft" on an animal or "let AI find more animals".
Falls back to a canned template when ANTHROPIC_API_KEY is absent so the app works offline.
"""

from __future__ import annotations

import json
from typing import Any

from .config import settings

_GUIDE_SYSTEM = """You are a veterinary care writer. Given a pet species, output a JSON object
with these string fields: lifespan_years, adult_size, healthy_markers, diet, training, housing,
common_issues, age_stages. Keep each field under 800 characters. age_stages should be a JSON
array (as a string) of {stage, age_range, size, feeding, notes} for juvenile, adult, senior.
Respond with JSON only, no prose."""

_ANIMAL_SYSTEM = """You are a pet-ownership expert. Given a count, list that many distinct species
commonly kept as pets that a user might not already have. Output JSON only:
[{"name": "...", "category": "mammal|bird|reptile|fish|amphibian|invertebrate", "short_description": "..."}]."""


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


def generate_guide_draft(animal_name: str) -> dict[str, str]:
    if not settings.anthropic_api_key:
        return _canned_guide(animal_name)

    try:
        import anthropic  # lazy import — only loaded if we have a key
    except ImportError:
        return _canned_guide(animal_name)

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system=_GUIDE_SYSTEM,
        messages=[{"role": "user", "content": f"Species: {animal_name}"}],
    )
    text = "".join(block.text for block in msg.content if hasattr(block, "text"))
    try:
        data: dict[str, Any] = json.loads(text)
    except json.JSONDecodeError:
        return _canned_guide(animal_name)
    # Coerce everything to strings
    return {k: (v if isinstance(v, str) else json.dumps(v)) for k, v in data.items()}


def suggest_more_animals(count: int = 5, exclude_names: list[str] | None = None) -> list[dict[str, str]]:
    exclude_names = exclude_names or []
    if not settings.anthropic_api_key:
        # Canned fallback list — useful if the admin clicks before setting the key.
        fallback = [
            {"name": "Axolotl", "category": "amphibian", "short_description": "Aquatic salamander that stays in larval form."},
            {"name": "Ferret", "category": "mammal", "short_description": "Playful, highly social mustelid."},
            {"name": "Hedgehog", "category": "mammal", "short_description": "Spiny insectivore, mostly nocturnal."},
            {"name": "Leopard Gecko", "category": "reptile", "short_description": "Docile, beginner-friendly lizard."},
            {"name": "Betta Fish", "category": "fish", "short_description": "Vibrant freshwater fighter fish."},
            {"name": "Cockatiel", "category": "bird", "short_description": "Affectionate small parrot with a crest."},
            {"name": "Guinea Pig", "category": "mammal", "short_description": "Social, vocal rodent."},
            {"name": "Rabbit", "category": "mammal", "short_description": "Intelligent lagomorph, litter-trainable."},
        ]
        return [a for a in fallback if a["name"] not in exclude_names][:count]

    try:
        import anthropic
    except ImportError:
        return []

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    user_msg = f"Suggest {count} species. Exclude: {', '.join(exclude_names) or 'none'}."
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=_ANIMAL_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )
    text = "".join(block.text for block in msg.content if hasattr(block, "text"))
    try:
        data = json.loads(text)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []
