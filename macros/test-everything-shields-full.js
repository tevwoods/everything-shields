/**
 * Full Everything Shields Foundry integration suite.
 *
 * Import and run from a sandbox Script macro:
 *   const { runEverythingShieldsSuite } = await import("/modules/everything-shields/macros/test-everything-shields-full.js");
 *   await runEverythingShieldsSuite();
 */

export async function runEverythingShieldsSuite() {
    const results = [];
    const moduleId = "everything-shields";
    let actor;

    const assert = (condition, message, detail = "") => {
        if (!condition) {
            throw new Error(`${message}${detail ? `: ${detail}` : ""}`);
        }
        return true;
    };

    const test = async (name, callback) => {
        const started = performance.now();
        try {
            await callback();
            results.push({ name, passed: true, duration: Math.round(performance.now() - started) });
        } catch (error) {
            console.error(`Everything Shields integration | ${name} failed`, error);
            results.push({
                name,
                passed: false,
                duration: Math.round(performance.now() - started),
                error: error.message
            });
        }
    };

    try {
        await test("module is active and exposes its public API", async () => {
            assert(game.modules.get(moduleId)?.active, "Module is not active");
            const api = game.pf2e?.EverythingShields;
            assert(api, "Module API is not registered");
            for (const method of ["RemovePropertyRune", "RemoveHardenedRune", "RemovePotencyRune"]) {
                assert(typeof api[method] === "function", `Missing API method ${method}`);
            }
        });

        await test("all nine module compendiums are discoverable and readable", async () => {
            const expected = [
                "actions",
                "adjustments",
                "archetypes",
                "effects",
                "fundamental-runes",
                "general-feats",
                "guide",
                "property-runes",
                "shields"
            ];
            const packs = expected.map(name => game.packs.get(`${moduleId}.everything-shields-${name}`));
            assert(packs.every(Boolean), "One or more compendium packs are missing");
            for (const pack of packs) {
                const documents = await pack.getDocuments();
                assert(documents.length > 0, `${pack.metadata.name} is empty`);
            }
        });

        await test("module settings are registered", async () => {
            const keys = [
                "disable-all-automations",
                "should-generate-shield-names",
                "should-generate-shield-descriptions",
                "should-calculate-shield-prices",
                "should-apply-recommended-changes-to-specific-shields",
                "use-reinforcing-rune-instead-of-potency-and-hardened"
            ];
            for (const key of keys) {
                const value = game.settings.get(moduleId, key);
                assert(typeof value === "boolean", `Setting ${key} is not registered`);
            }
        });

        await test("creates an isolated actor and imports a compendium shield", async () => {
            actor = await Actor.create({
                name: `Everything Shields Test ${foundry.utils.randomID()}`,
                type: "character"
            }, { temporary: false });
            assert(actor, "Failed to create test actor");

            const pack = game.packs.get(`${moduleId}.everything-shields-shields`);
            const shields = await pack.getDocuments();
            const source = shields.find(item => item.name === "Heater Shield") || shields[0];
            assert(source, "No shield document found");

            const [shield] = await actor.createEmbeddedDocuments("Item", [source.toObject()]);
            assert(shield, "Failed to import shield");
            assert(shield.type === "shield", "Imported item is not a shield");
        });

        await test("direct rune updates generate names and descriptions", async () => {
            let shield = actor.items.find(item => item.type === "shield");
            const baseName = shield.name;
            const baseHP = shield.system.hp.max;
            const baseHardness = shield.system.hardness;
            const rawPrice = shield.system.price?.value;
            const basePrice = typeof rawPrice === "number"
                ? rawPrice
                : (rawPrice?.copperValue ?? 0) / 100;

            await shield.update({
                "flags.everything-shields.hitPoints": baseHP,
                "flags.everything-shields.baseHP": baseHP,
                "flags.everything-shields.baseHardness": baseHardness,
                "flags.everything-shields.baseShieldName": baseName,
                "flags.everything-shields.hardness": baseHardness,
                "flags.everything-shields.name": baseName,
                "flags.everything-shields.price": basePrice,
                "flags.everything-shields.level": shield.system.level?.value ?? 0,
                "flags.everything-shields.description": shield.system.description?.value ?? "",
                "system.potencyRune.value": "1",
                "system.resiliencyRune.value": "greater",
                "system.propertyRune1.value": "Reflecting Shield Rune",
                "system.rules": [{
                    key: "FlatModifier",
                    selector: "ac",
                    value: 1,
                    type: "circumstance",
                    predicate: [],
                    label: "Everything Shields Integration",
                    _esRuneSource: "Reflecting Shield Rune"
                }]
            });

            await new Promise(resolve => setTimeout(resolve, 500));
            shield = actor.items.get(shield.id);
            const description = shield.system.description?.value ?? "";
            assert(shield.name.includes("+1"), `Potency prefix missing from ${shield.name}`);
            assert(shield.name.includes("Greater Hardened"), `Hardened prefix missing from ${shield.name}`);
            assert(shield.name.includes("Reflecting"), `Property rune missing from ${shield.name}`);
            assert(description.includes("everything-shields-remove-potency-rune"), "Potency removal button missing");
            assert(description.includes("everything-shields-remove-hardened-rune"), "Hardened removal button missing");
            assert(description.includes("everything-shields-remove-property-rune"), "Property removal button missing");
        });

        await test("removing a property rune clears its slot and owned rules", async () => {
            const shield = actor.items.find(item => item.type === "shield");
            await game.pf2e.EverythingShields.RemovePropertyRune(actor.id, shield.id, "Reflecting Shield Rune");
            const updated = actor.items.get(shield.id);
            assert(!updated.system.propertyRune1?.value, "Property rune slot was not cleared");
            assert(
                !(updated.system.rules || []).some(rule => rule._esRuneSource === "Reflecting Shield Rune"),
                "Rune-owned rule elements remain"
            );
            assert(
                actor.items.some(item => item.name === "Reflecting Shield Rune"),
                "Removed property rune was not returned to inventory"
            );
        });

        await test("removing hardened rune restores base hardness and returns the rune", async () => {
            const shield = actor.items.find(item => item.type === "shield");
            const baseHardness = shield.flags?.["everything-shields"]?.baseHardness;
            await game.pf2e.EverythingShields.RemoveHardenedRune(actor.id, shield.id);
            const updated = actor.items.get(shield.id);
            assert(!updated.system.resiliencyRune?.value, "Hardened rune was not cleared");
            assert(updated.system.hardness === baseHardness, "Base hardness was not restored");
            assert(actor.items.some(item => item.name === "Hardened Rune, Greater"), "Hardened rune was not returned");
        });

        await test("removing potency rune restores HP and clears dependent property slots", async () => {
            let shield = actor.items.find(item => item.type === "shield");
            await shield.update({
                "system.propertyRune2.value": "Seeing Shield Rune",
                "system.hp.max": 72,
                "system.hp.brokenThreshold": 36,
                "flags.everything-shields.baseHP": 24,
                "flags.everything-shields.materialModifier": 0
            });
            await game.pf2e.EverythingShields.RemovePotencyRune(actor.id, shield.id);
            shield = actor.items.get(shield.id);
            assert(!shield.system.potencyRune?.value, "Potency rune was not cleared");
            assert(!shield.system.propertyRune1?.value && !shield.system.propertyRune2?.value, "Property slots were not cascaded");
            assert(shield.system.hp.max === 24, `HP was not restored: ${shield.system.hp.max}`);
            assert(shield.system.hp.brokenThreshold === 12, "Broken threshold was not restored");
            assert(actor.items.some(item => item.name === "+1 Shield Potency Rune"), "Potency rune was not returned");
        });
    } finally {
        if (actor) {
            await actor.delete();
        }
    }

    const failures = results.filter(result => !result.passed);
    const content = `
        <h2>Everything Shields Full Integration Suite</h2>
        <p>${results.length - failures.length}/${results.length} passed</p>
        ${results.map(result => `
            <div style="color: ${result.passed ? "#51cf66" : "#ff6b6b"};">
                ${result.passed ? "PASS" : "FAIL"} — ${foundry.utils.escapeHTML(result.name)}
                ${result.error ? `: ${foundry.utils.escapeHTML(result.error)}` : ""}
                (${result.duration} ms)
            </div>
        `).join("")}
    `;

    await ChatMessage.create({
        user: game.user.id,
        content,
        whisper: [game.user.id]
    });
    ui.notifications[failures.length ? "error" : "info"](
        `Everything Shields: ${results.length - failures.length}/${results.length} integration tests passed`
    );
    console.table(results);
    return { passed: failures.length === 0, results };
}
