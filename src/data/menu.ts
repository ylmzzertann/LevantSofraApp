/**
 * The menu the restaurant opened with — now only the **seed** for an empty
 * database. `GET /api/menu` is the live source; staff edit dishes in the admin
 * panel, not in this file.
 *
 * Prices are written in dollars here because that is how a menu is read, and
 * converted to cents in `CATEGORIES` because that is how money is stored.
 *
 * Ingredients are a real field, not a split of the description (the prototype
 * derived them by splitting on commas). A `*` prefix marks an ingredient the
 * kitchen cannot leave out — you cannot take the lamb out of a kebab. Those
 * render without the tap affordance on the item screen.
 */

export type Tag = "veg" | "hot" | "pick";

export interface Ingredient {
  id: string;
  label: string;
  removable: boolean;
}

export interface Dish {
  id: string;
  cat: string;
  catLabel: string;
  name: string;
  /** Cents. */
  price: number;
  desc: string;
  long: string;
  tag: Tag | "";
  ingredients: Ingredient[];
  imageUrl: string | null;
  available: boolean;
}

export interface Category {
  key: string;
  label: string;
  sub: string;
  items: Dish[];
}

export const TAG_LABEL: Record<Tag, string> = {
  veg: "VEG",
  hot: "HOT",
  pick: "CHEF'S PICK",
};

export const TAG_COLOR: Record<Tag, string> = {
  veg: "var(--olive)",
  hot: "var(--terracotta)",
  pick: "var(--mustard)",
};

/** [id, name, price, desc, tag, long, ingredients] — `*` = not removable. */
type Row = [string, string, number, string, Tag | "", string, string[]];
type Raw = [key: string, label: string, sub: string, items: Row[]];

const RAW: Raw[] = [
  [
    "mezze",
    "Mezze",
    "Small plates",
    [
      [
        "muhammara",
        "Muhammara",
        11,
        "Roasted pepper, walnut, pomegranate molasses",
        "pick",
        "Aleppo pepper pounded with walnut and pomegranate molasses, finished with olive oil and a little cumin. Bread comes with it.",
        ["*Roasted pepper", "Walnut", "Pomegranate molasses", "Cumin", "Olive oil"],
      ],
      [
        "labneh",
        "Labneh & Za'atar",
        9,
        "Strained yoghurt, wild thyme, warm lavash",
        "veg",
        "Yoghurt hung overnight until thick, spooned flat and covered in wild thyme and green olive oil.",
        ["*Strained yoghurt", "Wild thyme", "Olive oil", "Warm lavash"],
      ],
      [
        "baba",
        "Baba Ghanoush",
        10,
        "Coal-roasted aubergine, tahini, lemon",
        "veg",
        "Aubergines blackened directly on the coals, then peeled and beaten with tahini and lemon.",
        ["*Coal-roasted aubergine", "Tahini", "Lemon", "Garlic"],
      ],
      [
        "ezme",
        "Ezme",
        8,
        "Hand-chopped tomato, chilli, sumac, mint",
        "veg",
        "Everything cut by hand, never blended — the texture is the point. Sharp with sumac.",
        ["*Tomato", "Chilli", "Sumac", "Mint", "Onion", "Parsley"],
      ],
      [
        "hummus",
        "Hummus Beiruti",
        9,
        "Chickpea, tahini, cumin, parsley",
        "veg",
        "Warm chickpeas, plenty of tahini, and a spoon of whole peas on top with cumin oil.",
        ["*Chickpea", "Tahini", "Cumin", "Parsley", "Garlic"],
      ],
      [
        "fava",
        "Fava & Dill",
        8,
        "Broad bean purée, dill, red onion",
        "veg",
        "Slow-cooked broad beans set with olive oil and cut with a lot of dill.",
        ["*Broad bean", "Dill", "Red onion", "Olive oil"],
      ],
    ],
  ],
  [
    "fire",
    "Fire & Coals",
    "From the grill",
    [
      [
        "adana",
        "Adana Kebab",
        19,
        "Hand-minced lamb, charcoal, sumac onion",
        "hot",
        "Lamb minced with a zırh blade and hot pepper, pressed onto a flat skewer over open charcoal.",
        ["*Hand-minced lamb", "Hot pepper", "Sumac onion", "Parsley", "Grilled tomato"],
      ],
      [
        "shish",
        "Lamb Shish",
        22,
        "Shoulder, oregano, grilled tomato",
        "",
        "Cubes of shoulder rested overnight in onion juice and oregano.",
        ["*Lamb shoulder", "Oregano", "Grilled tomato", "Grilled pepper", "Onion"],
      ],
      [
        "taouk",
        "Chicken Taouk",
        17,
        "Garlic-yoghurt marinade, toum, pickled turnip",
        "",
        "Thigh meat in yoghurt and garlic, grilled hard, served with toum sharp enough to sting.",
        ["*Chicken thigh", "Garlic-yoghurt marinade", "Toum", "Pickled turnip"],
      ],
      [
        "kofte",
        "Köfte",
        18,
        "Lamb & beef, cumin, grilled pepper",
        "",
        "A house mix rested a day before grilling, heavy on cumin.",
        ["*Lamb & beef", "Cumin", "Grilled pepper", "Onion"],
      ],
      [
        "lahm",
        "Lahm bi Ajin",
        14,
        "Thin lamb flatbread, pine nut, lemon",
        "",
        "Paper-thin dough spread with spiced lamb, out of the oven in ninety seconds.",
        ["*Thin flatbread", "*Spiced lamb", "Pine nut", "Lemon", "Parsley"],
      ],
    ],
  ],
  [
    "clay",
    "Clay Pot",
    "Slow cooked",
    [
      [
        "tagine",
        "Lamb Tagine",
        21,
        "Apricot, almond, saffron, seven spice",
        "",
        "Shoulder cooked four hours in a sealed pot with dried apricot and saffron.",
        ["*Lamb shoulder", "Dried apricot", "Almond", "Saffron", "Seven spice"],
      ],
      [
        "guvec",
        "Chicken Güveç",
        19,
        "Tomato, aubergine, pepper, bulgur",
        "",
        "Baked in an earthenware pot and brought to the table sealed.",
        ["*Chicken", "Tomato", "Aubergine", "Pepper", "Bulgur"],
      ],
      [
        "fasolia",
        "Fasolia",
        15,
        "White bean, tomato, olive oil",
        "veg",
        "Beans cooked down until creamy in a lot of olive oil. Eaten warm or cold.",
        ["*White bean", "Tomato", "Olive oil", "Onion"],
      ],
      [
        "moussaka",
        "Moussaka",
        18,
        "Aubergine, lamb, béchamel",
        "",
        "Layered and baked to order, so give it twenty minutes.",
        ["*Aubergine", "*Lamb", "Béchamel", "Tomato"],
      ],
    ],
  ],
  [
    "bread",
    "Bread & Pide",
    "From the stone oven",
    [
      [
        "pide",
        "Sucuk Pide",
        13,
        "Aged sausage, kasar, egg",
        "",
        "Boat-shaped dough from the stone oven, egg cracked over at the last moment.",
        ["*Pide dough", "Aged sucuk", "Kasar", "Egg"],
      ],
      [
        "manakish",
        "Manakish",
        9,
        "Za'atar, sesame, olive oil",
        "veg",
        "Flatbread painted with thyme and oil before it goes on the stone.",
        ["*Flatbread", "Za'atar", "Sesame", "Olive oil"],
      ],
      [
        "lavash",
        "Warm Lavash",
        5,
        "Blistered, salted, folded",
        "veg",
        "Comes out puffed and is torn at the table.",
        ["*Lavash", "Salt"],
      ],
      [
        "simit",
        "Simit & Butter",
        4,
        "Sesame ring, cultured butter",
        "veg",
        "Toasted and served with cold cultured butter.",
        ["*Sesame ring", "Cultured butter"],
      ],
    ],
  ],
  [
    "sea",
    "Sea",
    "Day boat",
    [
      [
        "octopus",
        "Grilled Octopus",
        24,
        "Fava purée, caper leaf, burnt lemon",
        "pick",
        "Braised in its own liquid, then charred hard on the coals.",
        ["*Octopus", "Fava purée", "Caper leaf", "Burnt lemon"],
      ],
      [
        "seabass",
        "Whole Sea Bass",
        26,
        "Salt-baked, herb oil, lemon",
        "",
        "Baked in a salt crust and cracked open in front of you.",
        ["*Whole sea bass", "Salt crust", "Herb oil", "Lemon"],
      ],
      [
        "calamari",
        "Fried Calamari",
        16,
        "Semolina crust, tarator",
        "",
        "Dusted in semolina, fried fast, served with garlic tarator.",
        ["*Calamari", "Semolina crust", "Tarator", "Lemon"],
      ],
      [
        "saganaki",
        "Shrimp Saganaki",
        18,
        "Tomato, ouzo, feta",
        "",
        "Cooked in a copper pan and finished under the grill with feta.",
        ["*Shrimp", "Tomato", "Ouzo", "Feta", "Chilli"],
      ],
    ],
  ],
  [
    "grain",
    "Pasta & Risotto",
    "Grains",
    [
      [
        "orzo",
        "Lamb Orzo",
        18,
        "Shoulder ragù, kasar, mint",
        "",
        "Orzo baked in lamb stock until it holds together like risotto.",
        ["*Orzo", "*Lamb ragù", "Kasar", "Mint"],
      ],
      [
        "risotto",
        "Saffron Risotto",
        19,
        "Saffron, brown butter, aged kasar",
        "veg",
        "Stirred to order with saffron steeped in warm stock.",
        ["*Risotto rice", "Saffron", "Brown butter", "Aged kasar"],
      ],
      [
        "trahana",
        "Trahana",
        15,
        "Fermented wheat, tomato, yoghurt",
        "veg",
        "A soured wheat porridge from the highlands, thickened with yoghurt.",
        ["*Fermented wheat", "Tomato", "Yoghurt", "Mint butter"],
      ],
    ],
  ],
  [
    "salad",
    "Salads",
    "Garden",
    [
      [
        "fattoush",
        "Fattoush",
        11,
        "Sumac, radish, fried bread",
        "veg",
        "Dressed at the last moment so the bread stays crisp.",
        ["*Leaves", "Sumac", "Radish", "Fried bread", "Tomato", "Cucumber"],
      ],
      [
        "tabbouleh",
        "Tabbouleh",
        10,
        "Parsley, mint, fine bulgur, lemon",
        "veg",
        "Mostly parsley, as it should be.",
        ["*Parsley", "Mint", "Fine bulgur", "Lemon", "Tomato"],
      ],
      [
        "shepherd",
        "Shepherd's Salad",
        9,
        "Tomato, cucumber, onion, sumac",
        "veg",
        "Cut small, dressed with lemon and olive oil only.",
        ["*Tomato", "Cucumber", "Onion", "Sumac", "Olive oil"],
      ],
    ],
  ],
  [
    "sweet",
    "Sweets",
    "To finish",
    [
      [
        "kunefe",
        "Künefe",
        12,
        "Shredded pastry, cheese, syrup",
        "pick",
        "Cooked to order in a copper dish and served while the cheese still pulls.",
        ["*Shredded pastry", "*Cheese", "Syrup", "Pistachio"],
      ],
      [
        "baklava",
        "Pistachio Baklava",
        10,
        "Forty layers, Antep pistachio",
        "",
        "Made with clarified butter and cut into three pieces.",
        ["*Filo", "*Antep pistachio", "Clarified butter", "Syrup"],
      ],
      [
        "muhallebi",
        "Muhallebi",
        8,
        "Milk pudding, rose, pistachio",
        "veg",
        "Set soft, scented lightly with rose.",
        ["*Milk pudding", "Rose", "Pistachio"],
      ],
      [
        "halva",
        "Tahini Halva Parfait",
        9,
        "Sesame, dark chocolate, sea salt",
        "veg",
        "Frozen tahini cream with cracked halva through it.",
        ["*Tahini cream", "Halva", "Dark chocolate", "Sea salt"],
      ],
    ],
  ],
  [
    "coffee",
    "Coffee & Tea",
    "Hot",
    [
      [
        "turkish",
        "Turkish Coffee",
        5,
        "Copper pot, lokum on the side",
        "veg",
        "Ground fine and brought up slowly in a copper pot, with a piece of lokum.",
        ["*Coffee", "Sugar", "Lokum"],
      ],
      [
        "mint",
        "Mint Tea",
        4,
        "Fresh mint, glass pot",
        "veg",
        "Fresh mint steeped in a glass pot, poured at the table.",
        ["*Fresh mint", "Sugar"],
      ],
      [
        "coldbrew",
        "Cardamom Cold Brew",
        6,
        "18-hour brew, cardamom",
        "veg",
        "Brewed cold for eighteen hours with crushed cardamom.",
        ["*Cold brew", "Cardamom", "Ice", "Milk"],
      ],
    ],
  ],
  [
    "bar",
    "Wine & Cocktails",
    "Bar",
    [
      [
        "arak",
        "Arak Spritz",
        14,
        "Arak, grapefruit, soda",
        "",
        "Arak lengthened with grapefruit and soda over a lot of ice.",
        ["*Arak", "Grapefruit", "Soda", "Ice"],
      ],
      [
        "sour",
        "Pomegranate Sour",
        15,
        "Rakı, pomegranate, lemon",
        "",
        "Shaken hard with pomegranate and lemon.",
        ["*Rakı", "Pomegranate", "Lemon", "Egg white"],
      ],
      [
        "assyrtiko",
        "Assyrtiko, glass",
        12,
        "Santorini, mineral, dry",
        "",
        "Dry, saline and built for the grill and the sea plates.",
        ["*Assyrtiko"],
      ],
    ],
  ],
];

function toIngredient(raw: string, dishId: string, i: number): Ingredient {
  const removable = !raw.startsWith("*");
  const label = removable ? raw : raw.slice(1);
  return { id: `${dishId}-${i}`, label, removable };
}

/** The seed menu. Prices converted from dollars to cents on the way out. */
export const CATEGORIES: Category[] = RAW.map(([key, label, sub, rows]) => ({
  key,
  label,
  sub,
  items: rows.map(([id, name, price, desc, tag, long, ingredients]) => ({
    id,
    cat: key,
    catLabel: label,
    name,
    price: Math.round(price * 100),
    desc,
    long: long || desc,
    tag,
    ingredients: ingredients.map((g, i) => toIngredient(g, id, i)),
    imageUrl: null,
    available: true,
  })),
}));

/** Flattens a menu into `{ dishId: dish }` for the lookups the screens need. */
export function indexDishes(categories: Category[]): Record<string, Dish> {
  return Object.fromEntries(categories.flatMap((c) => c.items).map((d) => [d.id, d]));
}

/** Unit prices in cents, the shape `computeTotals` wants. */
export function priceMap(categories: Category[]): Record<string, number> {
  return Object.fromEntries(categories.flatMap((c) => c.items).map((d) => [d.id, d.price]));
}
