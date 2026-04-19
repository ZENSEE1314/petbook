"""First-run seed — creates baseline species and a few demo products so the app isn't empty.

Usage: `python -m app.seed`
"""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from .db import Base, SessionLocal, engine
from .models import Animal, GuideEntry, Product

SPECIES = [
    ("dog", "Dog", "mammal", "Loyal, trainable, highly varied by breed."),
    ("cat", "Cat", "mammal", "Independent, agile, affectionate on their terms."),
    ("hamster", "Hamster", "mammal", "Small nocturnal rodent, easy to keep."),
    ("guinea-pig", "Guinea Pig", "mammal", "Social, vocal herbivore."),
    ("rabbit", "Rabbit", "mammal", "Intelligent lagomorph, can be litter-trained."),
    ("sugar-glider", "Sugar Glider", "mammal", "Tiny nocturnal marsupial that glides."),
    ("ferret", "Ferret", "mammal", "Playful mustelid with strong social needs."),
    ("hedgehog", "Hedgehog", "mammal", "Spiny insectivore, nocturnal."),
    ("chicken", "Chicken", "bird", "Egg-laying backyard bird."),
    ("duck", "Duck", "bird", "Waterfowl, can be raised for eggs and companionship."),
    ("parrot", "Parrot", "bird", "Long-lived, intelligent, highly vocal."),
    ("cockatiel", "Cockatiel", "bird", "Small affectionate parrot with a crest."),
    ("budgie", "Budgie", "bird", "Small social parakeet, great beginner bird."),
    ("owl", "Owl", "bird", "Specialist raptor — licensed keepers only in most regions."),
    ("finch", "Finch", "bird", "Small seed-eating songbird, best kept in pairs."),
    ("leopard-gecko", "Leopard Gecko", "reptile", "Docile, beginner-friendly lizard."),
    ("bearded-dragon", "Bearded Dragon", "reptile", "Diurnal lizard, interactive and hardy."),
    ("ball-python", "Ball Python", "reptile", "Calm snake, modest space needs."),
    ("axolotl", "Axolotl", "amphibian", "Aquatic salamander that stays in larval form."),
    ("betta-fish", "Betta Fish", "fish", "Vibrant freshwater fighter fish."),
    ("goldfish", "Goldfish", "fish", "Cold-water freshwater fish, long-lived."),
]

DEMO_PRODUCTS = [
    {
        "slug": "premium-dry-dog-food-5kg",
        "name": "Premium Dry Dog Food 5kg",
        "category": "food",
        "description": "Balanced adult dog kibble with real chicken.",
        "price_cents": 3999,
        "stock": 50,
        "suitable_for": json.dumps(["dog"]),
    },
    {
        "slug": "interactive-cat-toy",
        "name": "Interactive Cat Wand Toy",
        "category": "toy",
        "description": "Feather wand with retractable string.",
        "price_cents": 1299,
        "stock": 100,
        "suitable_for": json.dumps(["cat"]),
    },
    {
        "slug": "starter-hamster-cage",
        "name": "Starter Hamster Cage",
        "category": "cage",
        "description": "Ventilated multi-level cage with wheel.",
        "price_cents": 5499,
        "stock": 20,
        "suitable_for": json.dumps(["hamster"]),
    },
    {
        "slug": "sugar-glider-bonding-pouch",
        "name": "Sugar Glider Bonding Pouch",
        "category": "accessory",
        "description": "Fleece pouch to carry your glider during bonding.",
        "price_cents": 1599,
        "stock": 40,
        "suitable_for": json.dumps(["sugar-glider"]),
    },
    {
        "slug": "parrot-foraging-toy",
        "name": "Parrot Foraging Toy",
        "category": "toy",
        "description": "Refillable puzzle toy that keeps parrots busy.",
        "price_cents": 2299,
        "stock": 30,
        "suitable_for": json.dumps(["parrot", "cockatiel", "budgie"]),
    },
    {
        "slug": "reptile-uvb-bulb",
        "name": "Reptile UVB Bulb 10.0",
        "category": "accessory",
        "description": "UVB output for desert-species enclosures.",
        "price_cents": 2499,
        "stock": 25,
        "suitable_for": json.dumps(["bearded-dragon", "leopard-gecko"]),
    },
]


def run() -> None:
    Base.metadata.create_all(engine)
    db: Session = SessionLocal()
    try:
        for slug, name, category, desc in SPECIES:
            if db.query(Animal).filter(Animal.slug == slug).first():
                continue
            animal = Animal(slug=slug, name=name, category=category, short_description=desc)
            db.add(animal)
            db.flush()
            # Empty unpublished guide stub so admins have a place to edit.
            db.add(GuideEntry(animal_id=animal.id, is_published=False))

        for p in DEMO_PRODUCTS:
            if db.query(Product).filter(Product.slug == p["slug"]).first():
                continue
            db.add(Product(**p))

        db.commit()
        print(f"Seeded {len(SPECIES)} species and {len(DEMO_PRODUCTS)} products.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
