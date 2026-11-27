import fs from "fs";
import path from "path";

const packsDir = path.join(process.cwd(), "packs", "Everything-Shields");

function migrateDocument(document) {
    if (document.name === "Shield Proficiency") {
        document.system.rules = [{
            key: "MartialProficiency",
            definition: ["item:type:shield"],
            sameAs: "unarmed",
            label: "Shield Proficiency"
        }];
    }

    if (document.name === "Shield Raft") {
        for (const rule of document.system.rules) {
            if (rule.key === "FlatModifier" && rule.value?.brackets) {
                rule.value.field = "actor|system.skills.athletics.rank";
            }
        }
    }

    if (document.name === "Medium Shield Specialization") {
        document.system.rules[1].uuid =
            "Compendium.everything-shields.everything-shields-actions.Rqh2hHC1ZvQwnust";
    }

    if (document.name === "Anathematic Defense") {
        for (const choice of document.system.rules.find(rule => rule.key === "ChoiceSet")?.choices ?? []) {
            choice.value = choice.value.trim();
        }
        const effect = document.system.rules.find(rule => rule.key === "ActiveEffectLike");
        if (effect) {
            effect.path = "system.attributes.shield.hardness";
            effect.phase = "afterDerived";
        }
    }

    if (document.name === "Moonlit Shield Rune") {
        const sense = document.system.rules.find(rule => rule.key === "Sense");
        if (sense) {
            sense.selector = "low-light-vision";
        }
    }

    if (document.name === "Spellguarding Shield Rune") {
        const modifier = document.system.rules.find(rule => rule.key === "FlatModifier");
        if (modifier) {
            modifier.value = "{actor|system.attributes.shield.ac}";
        }
    }

    if (document.type === "armor" && document.system?.category === "shield") {
        const legacyBulk = document.system.weight?.value ?? document.system.bulk?.value ?? 1;
        const bulk = legacyBulk === "L" ? "L" : Number(legacyBulk);
        const acBonus = Number(document.system.armor?.value ?? 0);

        document.type = "shield";
        document.system.acBonus = acBonus;
        document.system.bulk = {
            heldOrStowed: bulk,
            value: bulk,
            per: 1
        };
        document.system.usage = {
            type: "held",
            hands: 1,
            value: "held-in-one-hand"
        };
        document.system.equipped = {
            carryType: "worn",
            handsHeld: 0
        };

        delete document.system.armor;
        delete document.system.category;
        delete document.system.weight;
    }
}

for (const filename of fs.readdirSync(packsDir).filter(file => file.endsWith(".json")).sort()) {
    const jsonPath = path.join(packsDir, filename);
    const documents = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    documents.forEach(migrateDocument);
    fs.writeFileSync(jsonPath, `${JSON.stringify(documents, null, 2)}\n`, "utf8");

    const dbPath = jsonPath.replace(/\.json$/, ".db");
    fs.writeFileSync(
        dbPath,
        `${documents.map(document => JSON.stringify(document)).join("\n")}\n`,
        "utf8"
    );
    console.log(`Migrated ${filename}: ${documents.length} documents`);
}
