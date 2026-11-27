import fs from "fs";
import path from "path";

const packsDir = path.join(process.cwd(), "packs", "Everything-Shields");

const descriptions = {
    "Practiced Materials": `<p><strong>Requirements</strong> You are wielding a shield in one or more hands.</p>
<p><strong>Frequency</strong> once per minute</p>
<hr>
<p>You have become so accustomed to wielding a shield while casting your spells that you can occasionally reach quickly into a pouch with your shield hand. You draw a scroll or wand into the hand that is wielding your shield and may Cast the Spell from the retrieved item (spending actions to do so as normal). You cannot Raise the Shield as long as the scroll or wand is in this hand.</p>`,
    "Anathematic Defense": `<p>You have trained relentlessly to defend against the attacks of your ancient foes. When you use the Shield Block reaction to block an attack from an enemy whose sanctification is the opposite of your own, your shield's Hardness is increased by 1. For example, this applies if you have the holy trait and defend against an attack from a creature that has the unholy trait.</p>`,
    "Sentient Rune - Charismatic": `<p><strong>Perception</strong> +19; precise vision 60 feet, imprecise hearing 30 feet</p>
<p><strong>Communication</strong> speech, telepathy with its wielder (Sylvan (living) or Necril (undead) and two other languages chosen when the rune is created)</p>
<p><strong>Skills</strong> varies, see abilities; <strong>Int</strong> +2; <strong>Wis</strong> +3; <strong>Cha</strong> +5; <strong>Will</strong> +22</p>
<hr>
<p><strong>Charismatic</strong> The creator chooses Deception, Diplomacy, Intimidation, or Performance. The rune is a master of the chosen skill with a +26 bonus to checks with it, and trained in the other listed skills with a +22 bonus. It gains the corresponding ability: Create a Diversion and Feint (Deception), Bon Mot (Diplomacy), Demoralize (Intimidation), or Fascinate (Performance).</p>
<p><strong>Independent</strong> At the start of each of your turns, a shield etched with a charismatic true living/undead rune gains 1 action. It can perform one of its skill-based actions, or prepare to Aid you with the chosen skill. If it prepares to Aid you, it gains a reaction usable only for that Aid.</p>
<p><strong>Bon Mot</strong> <span class="pf2-icon">1</span> The shield attempts a Diplomacy check to Bon Mot a creature as the skill feat. You suffer the penalty of a critical failure instead of the shield. If the target is affected, they may retort against you or the shield to remove the effect.</p>
<p><strong>Create a Diversion</strong> <span class="pf2-icon">1</span> The shield attempts a Deception check to Create a Diversion. On a success you become hidden to the target, which gains no circumstance bonus against later Create a Diversion attempts by the shield.</p>
<p><strong>Demoralize</strong> <span class="pf2-icon">1</span> The shield attempts an Intimidation check to Demoralize a creature. It takes no penalty for not sharing a language.</p>
<p><strong>Fascinate</strong> <span class="pf2-icon">1</span> The shield attempts a Performance check against the Will DC of a creature that can observe it. On a success or critical success, the target is fascinated as by the fascinated condition.</p>
<p><strong>Feint</strong> <span class="pf2-icon">1</span> The shield attempts a Deception check to Feint. On a success or critical success, the target is off-guard to you.</p>`,
    "Sentient Rune - Knowledgeable": `<p><strong>Perception</strong> +19; precise vision 60 feet, imprecise hearing 30 feet</p>
<p><strong>Communication</strong> speech, telepathy with its wielder (Sylvan (living) or Necril (undead) and two other languages chosen when the rune is created)</p>
<p><strong>Skills</strong> varies, see abilities; <strong>Int</strong> +5; <strong>Wis</strong> +3; <strong>Cha</strong> +2; <strong>Will</strong> +22</p>
<hr>
<p><strong>Knowledgeable</strong> The creator chooses three skills with Recall Knowledge actions, and two Lore skills. The rune is a master of those skills with a +26 bonus to checks with them. It is trained in other Recall Knowledge checks, with a +22 bonus.</p>
<p><strong>Independent</strong> At the start of each of your turns, a shield etched with a knowledgeable true living/undead rune gains 1 action. It can use Share Knowledge, or prepare to Aid you with a Recall Knowledge check. If it prepares to Aid you, it gains a reaction usable only for that Aid.</p>
<p><strong>Share Knowledge</strong> The shield attempts Recall Knowledge about an observed target. On a success or critical success it can immediately share the information. If the target is a creature and the shield identifies it, the shield points out a weak point; the first time you and each companion deal damage to that creature, you each deal an additional 1d6 precision damage.</p>`
};

const extractActionField = (description, label) => {
    const pattern = new RegExp(
        `<p><strong>${label}\\s*</strong>([\\s\\S]*?)</p>`,
        "i"
    );
    const match = description.match(pattern);
    return match ? match[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim() : "";
};

const reconcile = (document) => {
    if (descriptions[document.name]) {
        document.system.description.value = descriptions[document.name];
    }

    if (document.system?.description?.value) {
        document.system.description.value = document.system.description.value
            .replace(/\b(\d+(?:st|nd|rd|th))-level\b/g, "$1-rank");
    }

    if (document.name === "Disrupting Shield") {
        document.system.description.value = document.system.description.value
            .replace("diffcult task", "difficult task")
            .replace("On a critical hit, the target's action", "On a critical success, the target's action");
    }

    if (document.name === "Shield Smash") {
        document.system.description.value = document.system.description.value
            .replace("is Stupefied 2", "is stupefied 2");
    }

    if (document.name === "Practiced Materials") {
        document.system.actionType.value = "free";
        document.system.prerequisites.value = [
            { value: "expert in Arcana, Nature, Occultism, or Religion" }
        ];
    }

    if (document.name === "Anathematic Defense") {
        document.system.prerequisites.value = [
            { value: "master in Religion" },
            { value: "you have the holy or unholy trait" }
        ];
        document.system.rules = document.system.rules.filter(rule => rule.key !== "ChoiceSet");
        const effect = document.system.rules.find(rule => rule.key === "ActiveEffectLike");
        if (effect) {
            effect.value = 1;
        }
    }

    if (document.name === "Undead Shield Rune, True") {
        document.system.traits.rarity = "rare";
    }

    if (document.name === "Targe") {
        document.system.description.value = document.system.description.value
            .replace("fghters", "fighters")
            .replace("so that the grain of the wood is perpendicular", "so that the grains are perpendicular");
        document.system.traits.value = [...new Set(document.system.traits.value
            .filter(trait => trait !== "hb_shield-finesse")
            .concat("finesse"))];
    }

    if (document.name === "Shield Gauntlet") {
        document.system.traits.value = [...new Set(document.system.traits.value
            .filter(trait => trait !== "hb_shield-finesse")
            .concat("finesse"))];
    }

    if (document.name === "Scutum" || document.name === "Pavise") {
        document.system.baseItem = "tower-shield";
        document.system.speedPenalty = document.name === "Pavise" ? -10 : -5;
    }

    if (["Hoplon", "Scutum", "Pavise"].includes(document.name)) {
        document.system.speedPenalty = document.name === "Pavise" ? -10 : -5;
    }

    if (["Scutum", "Pavise"].includes(document.name)) {
        document.system.rules = document.system.rules.filter(rule => rule.slug !== "cumbersome-shield");
        document.system.rules.push({
            key: "FlatModifier",
            selector: "acrobatics",
            type: "circumstance",
            value: -2,
            label: "Cumbersome Shield",
            slug: "cumbersome-shield"
        });
    }

    if (["Kite Shield", "Scutum"].includes(document.name)) {
        document.system.rules = document.system.rules.filter(rule =>
            !["deflecting-shield", "deflecting-shield-hardness"].includes(rule.option || rule.slug)
        );
        document.system.rules.push(
            {
                key: "RollOption",
                domain: "all",
                option: "deflecting-shield",
                toggleable: true,
                label: "Deflecting Shield: ranged Shield Block"
            },
            {
                key: "ActiveEffectLike",
                mode: "add",
                path: "system.attributes.shield.hardness",
                value: 2,
                phase: "afterDerived",
                slug: "deflecting-shield-hardness",
                predicate: ["deflecting-shield"]
            }
        );
    }

    if (document.type === "shield") {
        document.system.rules = document.system.rules.filter(rule =>
            rule.option !== "intercepting-shield:magical-or-unarmed"
        );
    }

    if (document.name === "Intercepting Shield") {
        const note = `<p><strong>Precious-material note:</strong> A djezet or noqual shield also grants this reaction against ranged magical attacks and ranged unarmed attacks.</p>`;
        if (!document.system.description.value.includes("Precious-material note")) {
            document.system.description.value += note;
        }
    }

    if (document.name === "Heavy Shield Rune") {
        document.system.rules = [];
    }

    if (document.type === "action") {
        const description = document.system.description.value;
        document.system.requirements.value = extractActionField(description, "Requirements");
        document.system.trigger.value = extractActionField(description, "Trigger");
    }

    if (document.name === "Environmental Shield Rune, Greater") {
        document.system.description.value = `<p>This circular rune imbues your shield with the power to surround you with breathable air.</p>
<p>In addition, when activating this rune the wielder also gains the effects of 3rd-rank <em>environmental endurance</em>. Both effects last for 24 hours. These effects can now also be triggered when the wielder enters an area of severe cold or heat.</p>
<hr>
<p><strong>Activate</strong> <span class="pf2-icon">r</span> envision; <strong>Frequency</strong> once per day; <strong>Trigger</strong> You enter an area where you cannot breathe or an area of severe cold or heat; <strong>Effect</strong> A protective bubble emerges from your shield, granting you the benefits of  <em>air bubble</em> and 3rd-rank <em>environmental endurance</em>. Both effects last for 24 hours.</p>`;
    }

};

for (const filename of fs.readdirSync(packsDir).filter(file => file.endsWith(".json")).sort()) {
    const jsonPath = path.join(packsDir, filename);
    let documents = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    documents.forEach(reconcile);

    if (filename === "everything-shields-adjustments.json") {
        documents = documents.filter(document => !document.name.startsWith("Venom Pouch"));
    }

    fs.writeFileSync(jsonPath, `${JSON.stringify(documents, null, 2)}\n`, "utf8");
    fs.writeFileSync(
        jsonPath.replace(/\.json$/, ".db"),
        `${documents.map(document => JSON.stringify(document)).join("\n")}\n`,
        "utf8"
    );
}
