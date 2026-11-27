import { Pf2eRuleTestHarness } from "./pf2e-rule-test-harness.js";

const MODULE = "everything-shields";
const PACK = (name) => `${MODULE}.everything-shields-${name}`;

const RULE_ITEMS = [
    ["adjustments", "Ancestral Predator Shield Adjustment"],
    ["adjustments", "Coat of Arms Shield Adjustment"],
    ["archetypes", "Shield Maven Dedication"],
    ["archetypes", "Mirror Warrior Dedication"],
    ["archetypes", "Flickering Feint"],
    ["general-feats", "Shield Proficiency"],
    ["general-feats", "Shield Raft"],
    ["general-feats", "Light Shield Specialization"],
    ["general-feats", "Anathematic Defense"],
    ["general-feats", "Heavy Shield Specialization"],
    ["general-feats", "Medium Shield Specialization"],
    ["general-feats", "Seasoned Shield Warrior"],
    ["property-runes", "Energy-Resistant Shield Rune"],
    ["property-runes", "Moonlit Shield Rune"],
    ["property-runes", "Seeing Shield Rune"],
    ["property-runes", "Seeing Shield Rune, Greater"],
    ["property-runes", "Glamorous Shield Rune"],
    ["property-runes", "Darkness Shield Rune"],
    ["property-runes", "Seeing Shield Rune, Major"],
    ["property-runes", "Energy-Resistant Shield Rune, Greater"],
    ["property-runes", "Spellguarding Shield Rune"],
    ["property-runes", "Knowing Shield Rune"],
    ["property-runes", "Energy-Resistant Shield Rune, Major"]
];

export async function runPf2eRuleElementSuite() {
    const harness = new Pf2eRuleTestHarness({
        actorName: "Everything Shields Rule Test"
    });

    try {
        for (const [pack, name] of RULE_ITEMS) {
            await harness.test(`${name} compiles all Rule Elements in PF2e`, async () => {
                const actor = await harness.createActor();
                const item = await harness.importItem(actor, PACK(pack), name, {
                    equip: true,
                    choices: { default: "__first__" }
                });
                harness.assert(item.rules.length > 0, `${name} compiled no Rule Elements`);
                await actor.delete();
                harness.actors.delete(actor);
            });
        }

        const modifierCases = [
            ["Ancestral Predator Shield Adjustment", "adjustments", "intimidation", 1, ["ancestral-predator"]],
            ["Coat of Arms Shield Adjustment", "adjustments", "diplomacy", 1, ["coat-of-arms"]],
            ["Flickering Feint", "archetypes", "deception", 1, ["action:feint"]],
            ["Shield Raft", "general-feats", "athletics", 2, ["action:swim"]],
            ["Seeing Shield Rune", "property-runes", "perception", 1, ["action:sense-motive"]],
            ["Seeing Shield Rune, Greater", "property-runes", "perception", 2, ["disbelieve-an-illusion"]],
            ["Glamorous Shield Rune", "property-runes", "deception", 1, ["action:feint"]],
            ["Darkness Shield Rune", "property-runes", "stealth", 1, []],
            ["Seeing Shield Rune, Major", "property-runes", "perception", 3, ["action:sense-motive"]],
            ["Knowing Shield Rune", "property-runes", "arcana", 1, ["action:recall-knowledge"]]
        ];

        for (const [name, pack, statistic, expectedDelta, options] of modifierCases) {
            await harness.test(`${name} changes PF2e statistics`, async () => {
                const actor = await harness.createActor();
                if (name === "Shield Raft") {
                    await actor.update({ "system.skills.athletics.rank": 1 });
                }
                const baseline = harness.statistic(actor, statistic, options).mod;
                const item = await harness.importItem(actor, PACK(pack), name, { equip: true });
                harness.assertModifier(actor, {
                    statistic,
                    expectedDelta,
                    extraRollOptions: options,
                    ownerItem: item,
                    baseline
                });
            });
        }

        const grants = [
            ["Shield Maven Dedication", ["Shield Ricochet Stance"]],
            ["Mirror Warrior Dedication", ["Directed Shatter"]],
            ["Light Shield Specialization", ["Catch and Twist", "Disrupting Shield", "Intercepting Shield"]],
            ["Heavy Shield Specialization", ["Bulwark Shield", "Shoving Shield"]],
            ["Medium Shield Specialization", ["Aiding Shield", "Covering Shield"]]
        ];

        for (const [name, grantedNames] of grants) {
            await harness.test(`${name} grants every declared action`, async () => {
                const pack = name === "Shield Maven Dedication" || name === "Mirror Warrior Dedication"
                    ? "archetypes"
                    : "general-feats";
                const actor = await harness.createActor();
                const item = await harness.importItem(actor, PACK(pack), name);
                for (const grantedName of grantedNames) {
                    await harness.assertGrantItem(actor, item, grantedName);
                }
                harness.assert(
                    actor.items.filter(candidate => candidate.flags?.pf2e?.grantedBy?.id === item.id).length === grantedNames.length,
                    `${name} granted the wrong number of items`
                );
            });
        }

        await harness.test("Seasoned Shield Warrior changes encumbrance bonuses", async () => {
            const actor = await harness.createActor();
            const item = await harness.importItem(actor, PACK("general-feats"), "Seasoned Shield Warrior");
            harness.assertCompiledRules(item);
            harness.assert(actor.system.attributes.bonusLimitBulk === 2, "bonusLimitBulk was not increased");
            harness.assert(actor.system.attributes.bonusEncumbranceBulk === 2, "bonusEncumbranceBulk was not increased");
        });

        await harness.test("Shield Proficiency follows unarmed proficiency", async () => {
            const actor = await harness.createActor();
            await actor.update({ "system.proficiencies.attacks.unarmed.rank": 2 });
            const item = await harness.importItem(actor, PACK("general-feats"), "Shield Proficiency");
            harness.assertCompiledRules(item);
            const shieldProficiency = actor.system.proficiencies.attacks["shield-proficiency"];
            harness.assert(shieldProficiency, "Shield proficiency was not synthesized");
            harness.assert(
                shieldProficiency.rank === 2 && shieldProficiency.sameAs === "unarmed",
                "Shield proficiency did not follow unarmed proficiency"
            );
        });

        await harness.test("Anathematic Defense RollOption and ActiveEffectLike work together", async () => {
            const actor = await harness.createActor();
            await harness.equipShield(actor);
            await harness.addRaiseShieldEffect(actor);
            const baseline = actor.system.attributes.shield.hardness;
            const item = await harness.importItem(actor, PACK("general-feats"), "Anathematic Defense");
            const option = item.rules.find(rule => rule.key === "RollOption");
            harness.assert(option, "Anathematic Defense RollOption was not compiled");
            await option.toggle();
            await harness.settle();
            harness.assert(
                actor.getRollOptions().includes("anathematic-defense"),
                "Anathematic Defense roll option was not enabled"
            );
            harness.assert(
                actor.system.attributes.shield.hardness === baseline + 1,
                "Anathematic Defense hardness bonus was not applied",
                `${actor.system.attributes.shield.hardness} !== ${baseline + 1}`
            );
        });

        for (const [name, resistance] of [
            ["Energy-Resistant Shield Rune", 3],
            ["Energy-Resistant Shield Rune, Greater", 6],
            ["Energy-Resistant Shield Rune, Major", 10]
        ]) {
            await harness.test(`${name} applies the selected PF2e resistance`, async () => {
                const actor = await harness.createActor();
                const item = await harness.importItem(actor, PACK("property-runes"), name, {
                    equip: true,
                    choices: { "everything-shields-energy-resistant-element": "cold" }
                });
                harness.assertRuleKeys(item, ["ChoiceSet", "Resistance"]);
                harness.assertResistance(actor, "cold", resistance, item.name);
            });
        }

        await harness.test("Moonlit Shield Rune grants low-light vision while shield is raised", async () => {
            const actor = await harness.createActor();
            const item = await harness.importItem(actor, PACK("property-runes"), "Moonlit Shield Rune", { equip: true });
            harness.assertRuleKeys(item, ["Sense"]);
            harness.assert(
                !actor.perception.senses.some(sense => sense.type === "low-light-vision"),
                "Low-light vision applied without Raise a Shield"
            );
            await harness.addRaiseShieldEffect(actor);
            harness.assert(
                actor.perception.senses.some(sense => sense.type === "low-light-vision"),
                "Low-light vision was not applied with Raise a Shield"
            );
        });

        await harness.test("Spellguarding Shield Rune applies shield AC to spell saves while raised", async () => {
            const actor = await harness.createActor();
            await harness.equipShield(actor);
            await harness.addRaiseShieldEffect(actor);
            const shieldAC = actor.system.attributes.shield.ac;
            harness.assert(shieldAC > 0, "Raised-shield fixture has no shield AC");
            const item = await harness.importItem(
                actor,
                PACK("property-runes"),
                "Spellguarding Shield Rune",
                { equip: true }
            );
            const baseline = harness.statistic(actor, "fortitude").mod;
            harness.assertModifier(actor, {
                statistic: "fortitude",
                expectedDelta: shieldAC,
                extraRollOptions: ["item:type:spell", "self:effect:raise-a-shield"],
                ownerItem: item,
                baseline
            });
        });

        await harness.test("+1 potency rune mutates HP, BT, cost, level, name, and description", async () => {
            const actor = await harness.createActor();
            const shield = await harness.equipShield(actor);
            const shieldId = shield.id;
            const updated = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-fundamental-runes.Item.gJ7GkSRmcDZWEa89",
                shieldId
            );

            harness.assertShieldValues(updated, {
                "system.hp.max": 54,
                "system.hp.brokenThreshold": 27,
                "system.hardness": 5,
                "system.level.value": 3
            });
            harness.assert(harness.coinsInGold(updated.system.price.value) === 39, "Potency rune price is incorrect");
            harness.assert(updated.name.startsWith("+1 "), "Potency rune did not update the name");
            harness.assert(
                updated.system.description.value.includes('class="everything-shields_hit-points">54</td>'),
                "Description HP table was not updated"
            );
            harness.assert(
                updated.system.description.value.includes('class="everything-shields_broken-threshold">27</td>'),
                "Description BT table was not updated"
            );
            harness.assert(
                updated.system.description.value.includes("everything-shields-remove-potency-rune"),
                "Potency removal button is missing"
            );
        });

        await harness.test("greater hardened rune mutates hardness, cost, level, name, and description table", async () => {
            const actor = await harness.createActor();
            const shield = await harness.equipShield(actor);
            const updated = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-fundamental-runes.Item.Ch1frVT6Ev8Ob84p",
                shield.id
            );

            harness.assertShieldValues(updated, {
                "system.hp.max": 18,
                "system.hp.brokenThreshold": 9,
                "system.hardness": 12,
                "system.level.value": 12
            });
            harness.assert(harness.coinsInGold(updated.system.price.value) === 1069, "Hardened rune price is incorrect");
            harness.assert(updated.name.includes("Greater Hardened"), "Hardened rune did not update the name");
            harness.assert(
                updated.system.description.value.includes('class="everything-shields_hardness">12</td>'),
                "Description hardness table was not updated"
            );
            harness.assert(
                updated.system.description.value.includes("everything-shields-remove-hardened-rune"),
                "Hardened removal button is missing"
            );
        });

        await harness.test("property rune mutates price, level, name, and full description", async () => {
            const actor = await harness.createActor();
            let shield = await harness.equipShield(actor);
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-fundamental-runes.Item.gJ7GkSRmcDZWEa89",
                shield.id
            );
            const livingRune = "Compendium.everything-shields.everything-shields-property-runes.Item.0U9ZtRPk7YMwKoAi";
            shield = await harness.applyCompendiumRune(actor, livingRune, shield.id);

            harness.assertShieldValues(shield, {
                "system.hp.max": 54,
                "system.hp.brokenThreshold": 27,
                "system.hardness": 5,
                "system.level.value": 4
            });
            harness.assert(harness.coinsInGold(shield.system.price.value) === 164, "Property rune price is incorrect");
            harness.assert(shield.name.includes("Living"), "Property rune did not update the name");
            harness.assert(
                shield.system.description.value.includes('class="property-rune-living-shield-rune"'),
                "Property rune description section is missing"
            );
            harness.assert(
                shield.system.description.value.includes("Remove Living Shield Rune"),
                "Property rune removal button is missing"
            );
            harness.assert(
                shield.system.description.value.includes("Living Shield Rune"),
                "Property rune description text is missing"
            );
        });

        await harness.test("removing potency fully restores a property-rune shield", async () => {
            const actor = await harness.createActor();
            let shield = await harness.equipShield(actor);
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-fundamental-runes.Item.gJ7GkSRmcDZWEa89",
                shield.id
            );
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-property-runes.Item.0U9ZtRPk7YMwKoAi",
                shield.id
            );

            await game.pf2e.EverythingShields.RemovePotencyRune(actor.id, shield.id);
            const restored = actor.items.get(shield.id);
            harness.assertShieldValues(restored, {
                "system.hp.max": 18,
                "system.hp.brokenThreshold": 9,
                "system.hardness": 5,
                "system.level.value": 0
            });
            harness.assert(harness.coinsInGold(restored.system.price.value) === 4, "Base price was not restored");
            harness.assert(restored.name === "Heater Shield", "Base name was not restored");
            harness.assert(
                !restored.system.description.value.includes("property-rune-living-shield-rune"),
                "Property rune description was not removed"
            );
            harness.assert(
                !restored.system.description.value.includes("everything-shields-remove-potency-rune"),
                "Rune buttons were not removed"
            );
        });

        const potencyCases = [
            ["+2", "Compendium.everything-shields.everything-shields-fundamental-runes.Item.2l5jBKJ8epYcm1HQ", 90, 45, 939],
            ["+3", "Compendium.everything-shields.everything-shields-fundamental-runes.Item.e2JCjAh4od5JImA7", 126, 63, 8939]
        ];
        for (const [label, uuid, hp, brokenThreshold, price] of potencyCases) {
            await harness.test(`${label} potency rune applies all derived values`, async () => {
                const actor = await harness.createActor();
                const shield = await harness.equipShield(actor);
                const updated = await harness.applyCompendiumRune(actor, uuid, shield.id);
                harness.assertShieldValues(updated, {
                    "system.hp.max": hp,
                    "system.hp.brokenThreshold": brokenThreshold,
                    "system.hardness": 5
                });
                harness.assert(harness.coinsInGold(updated.system.price.value) === price, `${label} price is incorrect`);
                harness.assert(updated.name.startsWith(label), `${label} name prefix is missing`);
            });
        }

        const hardenedCases = [
            ["Hardened Rune", "Compendium.everything-shields.everything-shields-fundamental-runes.Item.cRUe2aZ2ZWApevmO", 8, 69, "Hardened"],
            ["Hardened Rune, Major", "Compendium.everything-shields.everything-shields-fundamental-runes.Item.FxxqBzTZlHuM0bWh", 16, 20069, "Major Hardened"]
        ];
        for (const [name, uuid, hardness, price, nameToken] of hardenedCases) {
            await harness.test(`${name} applies all derived values`, async () => {
                const actor = await harness.createActor();
                const shield = await harness.equipShield(actor);
                const updated = await harness.applyCompendiumRune(actor, uuid, shield.id);
                harness.assertShieldValues(updated, {
                    "system.hp.max": 18,
                    "system.hp.brokenThreshold": 9,
                    "system.hardness": hardness
                });
                harness.assert(harness.coinsInGold(updated.system.price.value) === price, `${name} price is incorrect`);
                harness.assert(updated.name.includes(nameToken), `${name} name marker is missing`);
            });
        }

        await harness.test("potency, hardened, and material modifiers compose correctly", async () => {
            const actor = await harness.createActor();
            let shield = await harness.equipShield(actor);
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-fundamental-runes.Item.gJ7GkSRmcDZWEa89",
                shield.id
            );
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-fundamental-runes.Item.Ch1frVT6Ev8Ob84p",
                shield.id
            );
            await shield.update({
                "system.material.type": "cold-iron",
                "system.material.grade": "high"
            });
            await harness.settle(150);
            shield = actor.items.get(shield.id);

            harness.assertShieldValues(shield, {
                "system.hp.max": 74,
                "system.hp.brokenThreshold": 37,
                "system.hardness": 17
            });
            harness.assert(harness.coinsInGold(shield.system.price.value) === 6604, "Combined material/rune price is incorrect");
            harness.assert(shield.system.level.value === 15, "Combined material/rune level is incorrect");
            harness.assert(
                shield.system.description.value.includes('class="everything-shields_hit-points">74</td>'),
                "Combined description HP is incorrect"
            );
        });

        await harness.test("potency property-rune slots cap additions at tier and reject duplicates", async () => {
            const actor = await harness.createActor();
            let shield = await harness.equipShield(actor);
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-fundamental-runes.Item.gJ7GkSRmcDZWEa89",
                shield.id
            );
            const living = "Compendium.everything-shields.everything-shields-property-runes.Item.0U9ZtRPk7YMwKoAi";
            const focusing = "Compendium.everything-shields.everything-shields-property-runes.Item.KvP7y9a8AmOgbaxs";
            shield = await harness.applyCompendiumRune(actor, living, shield.id);
            shield = await harness.applyCompendiumRune(actor, living, shield.id);
            harness.assert(shield.system.propertyRune1.value === "Living Shield Rune", "Duplicate changed slot one");
            harness.assert(!shield.system.propertyRune2.value, "Duplicate occupied a second slot");
            await harness.applyCompendiumRune(actor, focusing, shield.id);
            shield = actor.items.get(shield.id);
            harness.assert(shield.system.propertyRune1.value === "Living Shield Rune", "Full slot was overwritten");
            harness.assert(!shield.system.propertyRune2.value, "Lower-tier shield accepted a second property rune");
        });

        await harness.test("higher potency unlocks three property-rune slots", async () => {
            const actor = await harness.createActor();
            let shield = await harness.equipShield(actor);
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-fundamental-runes.Item.e2JCjAh4od5JImA7",
                shield.id
            );
            const runes = [
                "Compendium.everything-shields.everything-shields-property-runes.Item.0U9ZtRPk7YMwKoAi",
                "Compendium.everything-shields.everything-shields-property-runes.Item.KvP7y9a8AmOgbaxs",
                "Compendium.everything-shields.everything-shields-property-runes.Item.7kzEz0aqWoGaM9KF"
            ];
            for (const rune of runes) shield = await harness.applyCompendiumRune(actor, rune, shield.id);
            harness.assert(
                [shield.system.propertyRune1.value, shield.system.propertyRune2.value, shield.system.propertyRune3.value]
                    .filter(Boolean).length === 3,
                "+3 potency did not unlock three slots"
            );
        });

        await harness.test("property rune upgrades replace the lesser version and return it", async () => {
            const actor = await harness.createActor();
            let shield = await harness.equipShield(actor);
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-fundamental-runes.Item.2l5jBKJ8epYcm1HQ",
                shield.id
            );
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-property-runes.Item.OT5bsSF9T289hzzV",
                shield.id
            );
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-property-runes.Item.OaN1UTCUZTA8JWls",
                shield.id
            );
            harness.assert(shield.system.propertyRune1.value === "Reflecting Shield Rune, Greater", "Lesser rune was not upgraded");
            harness.assert(actor.items.some(item => item.name === "Reflecting Shield Rune"), "Replaced rune was not returned");
            harness.assert(harness.coinsInGold(shield.system.price.value) === 3439, "Upgraded price is incorrect");
        });

        await harness.test("cancelling a compendium rune leaves the shield unchanged and returns the rune to inventory", async () => {
            const actor = await harness.createActor();
            const shield = await harness.equipShield(actor);
            const baseline = shield.toObject();
            await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-fundamental-runes.Item.gJ7GkSRmcDZWEa89",
                shield.id,
                { action: "cancel" }
            );
            const updated = actor.items.get(shield.id);
            harness.assert(updated.system.potencyRune.value === baseline.system.potencyRune.value, "Cancellation changed potency");
            harness.assert(harness.coinsInGold(updated.system.price.value) === 4, "Cancellation changed price");
            harness.assert(actor.items.some(item => item.name === "+1 Shield Potency Rune"), "Cancelled rune was not added to inventory");
        });

        await harness.test("property removal recalculates price and description", async () => {
            const actor = await harness.createActor();
            let shield = await harness.equipShield(actor);
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-fundamental-runes.Item.gJ7GkSRmcDZWEa89",
                shield.id
            );
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-property-runes.Item.0U9ZtRPk7YMwKoAi",
                shield.id
            );
            await game.pf2e.EverythingShields.RemovePropertyRune(actor.id, shield.id, "Living Shield Rune");
            const updated = actor.items.get(shield.id);
            harness.assert(harness.coinsInGold(updated.system.price.value) === 39, "Property rune price was not removed");
            harness.assert(updated.system.level.value === 3, "Property rune level was not recalculated");
            harness.assert(!updated.system.description.value.includes("property-rune-living-shield-rune"), "Property description remains");
        });

        await harness.test("hardened removal restores hardness, price, level, and description", async () => {
            const actor = await harness.createActor();
            let shield = await harness.equipShield(actor);
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-fundamental-runes.Item.Ch1frVT6Ev8Ob84p",
                shield.id
            );
            await game.pf2e.EverythingShields.RemoveHardenedRune(actor.id, shield.id);
            const updated = actor.items.get(shield.id);
            harness.assertShieldValues(updated, {
                "system.hardness": 5,
                "system.level.value": 0
            });
            harness.assert(harness.coinsInGold(updated.system.price.value) === 4, "Hardened price was not restored");
            harness.assert(updated.name === "Heater Shield", "Hardened name was not restored");
            harness.assert(!updated.system.description.value.includes("everything-shields-remove-hardened-rune"), "Hardened button remains");
        });

        await harness.test("reinforcing mode uses PF2e-derived HP and hardness", async () => {
            const actor = await harness.createActor();
            const shield = await harness.equipShield(actor);
            await harness.setModuleSetting("use-reinforcing-rune-instead-of-potency-and-hardened", true, async () => {
                await shield.update({ "system.runes.reinforcing": 2 });
                await harness.settle(150);
                const updated = actor.items.get(shield.id);
                harness.assertShieldValues(updated, {
                    "system.hp.max": 70,
                    "system.hp.brokenThreshold": 35,
                    "system.hardness": 8
                });
            });
        });

        await harness.test("damage crosses broken threshold and repair removes it", async () => {
            const actor = await harness.createActor();
            const shield = await harness.equipShield(actor);
            await game.pf2e.EverythingShields.ApplyDamage(actor.id, shield.id, 10);
            let updated = actor.items.get(shield.id);
            harness.assert(updated.system.hp.value === 8, "Damage did not reduce current HP");
            harness.assert(actor.system.attributes.shield.broken, "PF2e did not derive broken state");

            await game.pf2e.EverythingShields.Repair(actor.id, shield.id, 4);
            updated = actor.items.get(shield.id);
            harness.assert(updated.system.hp.value === 12, "Repair did not restore HP");
            harness.assert(!actor.system.attributes.shield.broken, "PF2e did not clear broken state");
        });

        await harness.test("custom shield traits compile and apply native strike and skill behavior", async () => {
            let actor = await harness.createActor();
            let shield = await harness.equipShield(actor, "Targe");
            const targeStrike = actor.system.actions.find(action => action.slug === "targe");
            harness.assert(shield.system.traits.value.includes("finesse"), "Targe lost its finesse trait");
            harness.assert(targeStrike.options.includes("finesse"), "Targe strike does not use finesse");
            await actor.delete();
            harness.actors.delete(actor);

            actor = await harness.createActor();
            shield = await harness.equipShield(actor, "Scutum");
            harness.assert(shield.system.baseItem === "tower-shield", "Scutum is missing Take Cover behavior");
            harness.assert(shield.system.speedPenalty === -5, "Scutum speed penalty is incorrect");
            harness.assert(actor.skills.acrobatics.mod === -2, "Cumbersome Acrobatics penalty is not active");
        });

        await harness.test("deflecting shield hardness bonus is toggleable during ranged Shield Block", async () => {
            const actor = await harness.createActor();
            const shield = await harness.equipShield(actor, "Kite Shield");
            await harness.addRaiseShieldEffect(actor);
            const baseline = actor.system.attributes.shield.hardness;
            const toggle = shield.rules.find(rule => rule.option === "deflecting-shield");
            harness.assert(toggle, "Deflecting Shield toggle did not compile");
            await toggle.toggle();
            await harness.settle();
            harness.assert(
                actor.system.attributes.shield.hardness === baseline + 2,
                "Deflecting Shield did not increase hardness"
            );
        });

        await harness.test("property rune attack traits reach PF2e strike data and clear on removal", async () => {
            const actor = await harness.createActor();
            let shield = await harness.equipShield(actor);
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-fundamental-runes.Item.gJ7GkSRmcDZWEa89",
                shield.id
            );
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-property-runes.Item.dnZsDnKZoFMsXb4l",
                shield.id
            );
            const strike = actor.system.actions.find(action =>
                action.slug.includes("throwing-heater-shield")
            );
            harness.assert(shield.system.traits.value.includes("shield-throw-20"), "Throwing trait range is incorrect");
            harness.assert(strike?.altUsages.some(usage => usage.options.includes("ranged")), "Throwing shield has no ranged strike");

            await game.pf2e.EverythingShields.RemovePropertyRune(actor.id, shield.id, "Throwing Shield Rune");
            shield = actor.items.get(shield.id);
            harness.assert(
                !shield.system.traits.value.some(trait => trait.startsWith("shield-throw-")),
                "Throwing trait survived rune removal"
            );

        });

        const materialCases = [
            ["cold-iron", "low", 18, 5, 34, 2, 0],
            ["cold-iron", "standard", 26, 7, 340, 7, 0],
            ["cold-iron", "high", 38, 10, 5500, 15, 0],
            ["silver", "low", 10, 3, 34, 2, 0],
            ["silver", "standard", 18, 5, 340, 7, 0],
            ["silver", "high", 30, 8, 5500, 15, 0],
            ["abysium", "standard", 22, 6, 440, 8, 0],
            ["abysium", "high", 38, 10, 8800, 16, 0],
            ["adamantine", "standard", 38, 10, 440, 8, 0],
            ["adamantine", "high", 50, 18, 8800, 16, 0],
            ["duskwood", "standard", 18, 5, 400, 8, -1],
            ["duskwood", "high", 38, 8, 8000, 16, -1],
            ["djezet", "standard", 18, 5, 660, 8, 0],
            ["djezet", "high", 30, 8, 8800, 16, 0],
            ["dragonhide", "standard", 14, 4, 440, 8, 0],
            ["dragonhide", "high", 30, 8, 8800, 16, 0],
            ["inubrix", "standard", 14, 4, 352, 8, 0],
            ["inubrix", "high", 26, 7, 5500, 16, 0],
            ["dawnsilver", "standard", 18, 5, 400, 8, -1],
            ["dawnsilver", "high", 30, 8, 8000, 16, -1],
            ["noqual", "standard", 22, 6, 660, 8, 0],
            ["noqual", "high", 38, 10, 15400, 16, 0],
            ["orichalcum", "high", 62, 16, 13200, 17, 0],
            ["siccatite", "standard", 22, 6, 440, 8, 1],
            ["siccatite", "high", 38, 10, 8800, 16, 1]
        ];

        for (const [material, grade, hp, hardness, materialPrice, level, bulkModifier] of materialCases) {
            await harness.test(`${material} ${grade} mutates all medium-shield values`, async () => {
                const actor = await harness.createActor();
                const shield = await harness.equipShield(actor);
                await shield.update({
                    "system.material.type": material,
                    "system.material.grade": grade
                });
                await harness.settle(200);
                const updated = actor.items.get(shield.id);
                harness.assertShieldValues(updated, {
                    "system.hp.max": hp,
                    "system.hp.brokenThreshold": Math.floor(hp / 2),
                    "system.hardness": hardness,
                    "system.level.value": level
                });
                harness.assert(harness.coinsInGold(updated.system.price.value) === materialPrice, `${material} ${grade} price is incorrect`);
                harness.assert(updated.system.bulk.value === Math.max(0, 1 + bulkModifier), `${material} ${grade} bulk is incorrect`);
                if (["djezet", "noqual"].includes(material)) {
                    harness.assert(
                        actor.getRollOptions().includes("intercepting-shield:magical-or-unarmed"),
                        `${material} does not enable the expanded Intercepting Shield trigger`
                    );
                }
            });
        }

        await harness.test("material prices follow light and heavy shield categories", async () => {
            const expected = [
                ["Fist Shield", 300],
                ["Scutum", 340]
            ];
            for (const [shieldName, price] of expected) {
                const actor = await harness.createActor();
                const shield = await harness.equipShield(actor, shieldName);
                await shield.update({
                    "system.material.type": "cold-iron",
                    "system.material.grade": "standard"
                });
                await harness.settle(200);
                const updated = actor.items.get(shield.id);
                harness.assert(
                    harness.coinsInGold(updated.system.price.value) === price,
                    `${shieldName} material price category is incorrect`
                );
                await actor.delete();
                harness.actors.delete(actor);
            }
        });

        await harness.test("inventory-origin rune is consumed only after successful application", async () => {
            const actor = await harness.createActor();
            const shield = await harness.equipShield(actor);
            const runeUuid = "Compendium.everything-shields.everything-shields-fundamental-runes.Item.gJ7GkSRmcDZWEa89";
            const rune = await fromUuid(runeUuid);
            const [inventoryRune] = await actor.createEmbeddedDocuments("Item", [rune.toObject()]);

            await harness.applyCompendiumRune(actor, runeUuid, shield.id, {
                inventoryItemId: inventoryRune.id
            });

            harness.assert(!actor.items.has(inventoryRune.id), "Inventory rune was not consumed");
        });

        await harness.test("inventory-origin rune survives application cancellation", async () => {
            const actor = await harness.createActor();
            const shield = await harness.equipShield(actor);
            const runeUuid = "Compendium.everything-shields.everything-shields-fundamental-runes.Item.gJ7GkSRmcDZWEa89";
            const rune = await fromUuid(runeUuid);
            const [inventoryRune] = await actor.createEmbeddedDocuments("Item", [rune.toObject()]);

            await harness.applyCompendiumRune(actor, runeUuid, shield.id, {
                action: "cancel",
                inventoryItemId: inventoryRune.id
            });

            harness.assert(actor.items.has(inventoryRune.id), "Cancelled inventory rune was consumed");
            harness.assert(!actor.items.get(shield.id).system.potencyRune.value, "Cancelled rune changed shield");
        });

        await harness.test("property rune ChoiceSet selection injects selected resistance", async () => {
            const actor = await harness.createActor();
            let shield = await harness.equipShield(actor);
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-fundamental-runes.Item.gJ7GkSRmcDZWEa89",
                shield.id
            );
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-property-runes.Item.4HnyPHxnjgdg16dR",
                shield.id,
                { choice: "fire" }
            );
            harness.assertResistance(actor, "fire", 3);
            harness.assert(
                shield.system.rules.some(rule =>
                    rule.slug?.includes("-energy-resistant-shield-rune-")
                ),
                "ChoiceSet-derived rule was not injected"
            );
        });

        await harness.test("property rune ChoiceSet cancellation rolls back the rune slot", async () => {
            const actor = await harness.createActor();
            let shield = await harness.equipShield(actor);
            shield = await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-fundamental-runes.Item.gJ7GkSRmcDZWEa89",
                shield.id
            );
            await harness.applyCompendiumRune(
                actor,
                "Compendium.everything-shields.everything-shields-property-runes.Item.4HnyPHxnjgdg16dR",
                shield.id,
                { choice: "__cancel__" }
            );
            shield = actor.items.get(shield.id);
            harness.assert(!shield.system.propertyRune1.value, "Cancelled ChoiceSet left the rune installed");
            harness.assert(!shield.system.rules.some(rule => rule._esRuneSource), "Cancelled ChoiceSet left injected rules");
        });

        await harness.test("automation settings gate price, name, and description independently", async () => {
            await harness.setModuleSetting("should-calculate-shield-prices", false, async () => {
                await harness.setModuleSetting("should-generate-shield-names", false, async () => {
                    await harness.setModuleSetting("should-generate-shield-descriptions", false, async () => {
                        const actor = await harness.createActor();
                        const shield = await harness.equipShield(actor);
                        const originalDescription = shield.system.description.value;
                        const updated = await harness.applyCompendiumRune(
                            actor,
                            "Compendium.everything-shields.everything-shields-fundamental-runes.Item.gJ7GkSRmcDZWEa89",
                            shield.id
                        );
                        harness.assert(updated.name === "Heater Shield", "Name automation was not disabled");
                        harness.assert(harness.coinsInGold(updated.system.price.value) === 4, "Price automation was not disabled");
                        harness.assert(updated.system.description.value === originalDescription, "Description automation was not disabled");
                    });
                });
            });
        });

        for (const reinforcing of [1, 3]) {
            await harness.test(`reinforcing rune level ${reinforcing} uses PF2e-derived stats`, async () => {
                const actor = await harness.createActor();
                const shield = await harness.equipShield(actor);
                await harness.setModuleSetting("use-reinforcing-rune-instead-of-potency-and-hardened", true, async () => {
                    await shield.update({                     "system.runes.reinforcing": reinforcing });
                    await harness.settle(100);
                    const updated = actor.items.get(shield.id);
                    const expected = reinforcing === 1
                        ? { hp: 62, bt: 31, hardness: 8 }
                        : { hp: 82, bt: 41, hardness: 8 };
                    harness.assertShieldValues(updated, {
                        "system.hp.max": expected.hp,
                        "system.hp.brokenThreshold": expected.bt,
                        "system.hardness": expected.hardness
                    });
                });
            });
        }
    } finally {
        await harness.cleanup();
    }

    return harness.report({ title: "Everything Shields PF2e Rule Element Suite" });
}

