export class Pf2eRuleTestHarness {
    constructor({ actorType = "character", actorName = "PF2e Rule Test" } = {}) {
        this.actorType = actorType;
        this.actorName = actorName;
        this.actors = new Set();
        this.results = [];
    }

    assert(condition, message, detail = "") {
        if (!condition) {
            throw new Error(`${message}${detail ? `: ${detail}` : ""}`);
        }
        return true;
    }

    async test(name, callback) {
        const started = performance.now();
        const initialActors = new Set(this.actors);
        try {
            await this.withTimeout(
                callback(this),
                15000,
                `${name} timed out`
            );
            this.results.push({ name, passed: true, duration: Math.round(performance.now() - started) });
        } catch (error) {
            console.error(`PF2e Rule Test | ${name} failed`, error);
            this.results.push({
                name,
                passed: false,
                duration: Math.round(performance.now() - started),
                error: error.message
            });
        } finally {
            const scenarioActors = [...this.actors].filter(actor => !initialActors.has(actor));
            await this.cleanupActors(scenarioActors);
        }
    }

    async withTimeout(operation, milliseconds, message) {
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(message)), milliseconds);
        });
        try {
            return await Promise.race([Promise.resolve(operation), timeout]);
        } finally {
            clearTimeout(timer);
        }
    }

    async createActor(overrides = {}) {
        const actor = await this.withTimeout(
            Actor.create({
                name: `${this.actorName} ${foundry.utils.randomID()}`,
                type: this.actorType,
                ...overrides
            }, { temporary: false }),
            5000,
            "Timed out creating PF2e test actor"
        );
        this.actors.add(actor);
        return actor;
    }

    async getPackDocument(packId, name) {
        const pack = game.packs.get(packId);
        this.assert(pack, `Compendium not found`, packId);
        const document = (await pack.getDocuments()).find(item => item.name === name);
        this.assert(document, `Compendium document not found`, `${packId}: ${name}`);
        return document;
    }

    async embedItem(actor, source, options = {}) {
        const data = source.toObject();
        const choices = options.choices ?? {};

        if (options.equip && data.system?.equipped) {
            data.system.equipped = {
                ...data.system.equipped,
                carryType: "worn",
                inSlot: true,
                invested: true,
                handsHeld: 0
            };
        }

        const [item] = await this.withAutomaticChoiceSets(choices, async () =>
            actor.createEmbeddedDocuments("Item", [data])
        );
        await this.settle();
        this.assertCompiledRules(item);
        return item;
    }

    async importItem(actor, packId, name, options = {}) {
        return this.embedItem(actor, await this.getPackDocument(packId, name), options);
    }

    async equipShield(actor, name = "Heater Shield") {
        const source = await this.getPackDocument(
            "everything-shields.everything-shields-shields",
            name
        );
        const data = source.toObject();
        data.system.equipped = {
            carryType: "held",
            handsHeld: 1,
            invested: false,
            inSlot: true
        };
        const [shield] = await actor.createEmbeddedDocuments("Item", [data]);
        await this.settle();
        return shield;
    }

    async addRaiseShieldEffect(actor) {
        const effect = await fromUuid("Compendium.pf2e.equipment-effects.Item.2YgXoHvJfrDHucMr");
        this.assert(effect, "Raise a Shield effect not found");
        const [item] = await actor.createEmbeddedDocuments("Item", [effect.toObject()]);
        await this.settle();
        return item;
    }

    async applyCompendiumRune(actor, runeUuid, shieldId, {
        action = "apply",
        inventoryItemId,
        choice
    } = {}) {
        const dialogs = [];
        const OriginalDialog = window.Dialog;
        function AutomatedDialog(options) {
            dialogs.push(options);
            this.render = () => this;
            return this;
        }
        AutomatedDialog.confirm = OriginalDialog.confirm.bind(OriginalDialog);
        window.Dialog = AutomatedDialog;

        try {
            const dragData = { type: "Item", uuid: inventoryItemId ? "" : runeUuid };
            if (inventoryItemId) {
                const item = await fromUuid(runeUuid);
                dragData.data = {
                    ...item.toObject(),
                    _id: inventoryItemId,
                    pack: "everything-shields"
                };
            }
            const handled = Hooks.call(
                "dropActorSheetData",
                actor,
                { actor, render: () => {} },
                dragData
            );
            this.assert(handled === false, "Rune drop was not intercepted by Everything Shields");

            const deadline = performance.now() + 5000;
            while (dialogs.length === 0 && performance.now() < deadline) {
                await this.settle(10);
            }
            this.assert(dialogs.length > 0, "Rune application dialog was not created");

            const callback = dialogs[0].buttons[action]?.callback;
            this.assert(callback, `Rune application dialog has no ${action} action`);
            const callbackResult = callback({
                find: selector => {
                    this.assert(selector === "#shield-select", "Unexpected dialog selector", selector);
                    return { val: () => shieldId };
                }
            });
            if (choice) {
                const choiceDeadline = performance.now() + 5000;
                while (dialogs.length < 2 && performance.now() < choiceDeadline) {
                    await this.settle(10);
                }
                if (dialogs.length > 1) {
                    if (choice === "__cancel__") {
                        await dialogs[1].close?.();
                    } else {
                    const choiceButton = dialogs[1].buttons[choice]?.callback;
                    this.assert(choiceButton, `ChoiceSet option not found`, choice);
                    await choiceButton();
                    }
                }
            }
            await callbackResult;
            await this.settle(150);
            return actor.items.get(shieldId);
        } finally {
            window.Dialog = OriginalDialog;
        }
    }

    async setModuleSetting(key, value, operation) {
        const previous = game.settings.get("everything-shields", key);
        await game.settings.set("everything-shields", key, value);
        try {
            return await operation();
        } finally {
            await game.settings.set("everything-shields", key, previous);
        }
    }

    coinsInGold(value) {
        if (typeof value === "number") return value;
        return (value?.pp ?? 0) * 10 +
            (value?.gp ?? 0) +
            (value?.sp ?? 0) / 10 +
            (value?.cp ?? 0) / 100;
    }

    assertShieldValues(shield, expected) {
        for (const [path, value] of Object.entries(expected)) {
            const actual = foundry.utils.getProperty(shield, path);
            this.assert(
                actual === value,
                `${shield.name} ${path} is incorrect`,
                `${actual} !== ${value}`
            );
        }
    }

    async withAutomaticChoiceSets(choices, operation) {
        const ChoiceSet = game.pf2e.RuleElements.builtin.ChoiceSet;
        const original = ChoiceSet.prototype.preCreate;

        ChoiceSet.prototype.preCreate = async function (context) {
            const itemName = this.item?.name ?? "";
            const configured =
                choices[itemName] ??
                choices[this.flag] ??
                choices[this.item?.slug] ??
                choices[this.label] ??
                choices.default;

            if (this.selection === null) {
                const available = Array.isArray(this.choices) ? this.choices : [];
                const selected = (configured === undefined || configured === "__first__" ? available[0] : undefined) ??
                    available.find(choice => choice.value === configured) ??
                    available.find(choice => choice.label === configured);
                if (selected) {
                    this.selection = context.ruleSource.selection = selected.value;
                }
            }

            return original.call(this, context);
        };

        try {
            return await operation();
        } finally {
            ChoiceSet.prototype.preCreate = original;
        }
    }

    assertCompiledRules(item) {
        const expected = item.system.rules?.length ?? 0;
        const runtime = item.rules ?? [];
        this.assert(runtime.length === expected, `${item.name} compiled the wrong rule count`, `${runtime.length}/${expected}`);
        for (const rule of runtime) {
            this.assert(!rule.invalid, `${item.name} has an invalid ${rule.key} rule`, String(rule.validationFailures ?? ""));
            this.assert(!rule.ignored, `${item.name} ignored ${rule.key} rule`);
        }
    }

    assertRuleKeys(item, expectedKeys) {
        this.assert(
            JSON.stringify(item.rules.map(rule => rule.key)) === JSON.stringify(expectedKeys),
            `${item.name} Rule Element keys differ`,
            `${item.rules.map(rule => rule.key).join(",")} !== ${expectedKeys.join(",")}`
        );
    }

    statistic(actor, slug, extraRollOptions = []) {
        return actor.getStatistic(slug).withRollOptions({ extraRollOptions });
    }

    assertModifier(actor, {
        statistic,
        expectedDelta,
        extraRollOptions = [],
        ownerItem,
        expectedLabel,
        baseline
    }) {
        const baselineValue = baseline ?? this.statistic(actor, statistic).mod;
        const withOptions = this.statistic(actor, statistic, extraRollOptions).mod;
        this.assert(
            withOptions - baselineValue === expectedDelta,
            `${statistic} modifier delta is incorrect`,
            `${withOptions - baselineValue} !== ${expectedDelta}`
        );

        if (ownerItem || expectedLabel) {
            const statisticWithOptions = this.statistic(actor, statistic, extraRollOptions);
            const modifier = statisticWithOptions.modifiers.find(entry =>
                (ownerItem ? entry.source?.startsWith(ownerItem.uuid) : true) &&
                (expectedLabel ? entry.label === expectedLabel : true)
            );
            this.assert(modifier, `Expected modifier was not compiled for ${statistic}`, expectedLabel);
        }
    }

    assertResistance(actor, type, value, sourceName) {
        const resistance = actor.attributes.resistances.find(entry => entry.type === type);
        this.assert(resistance, `Missing resistance`, type);
        this.assert(resistance.value === value, `${type} resistance is incorrect`, `${resistance.value} !== ${value}`);
        if (sourceName) {
            this.assert(resistance.source === sourceName, `Resistance source is incorrect`, resistance.source);
        }
    }

    async assertGrantItem(actor, item, expectedName) {
        const granted = actor.items.find(candidate =>
            candidate.name === expectedName &&
            candidate.flags?.pf2e?.grantedBy?.id === item.id
        );
        this.assert(granted, `${item.name} did not grant ${expectedName}`);
        return granted;
    }

    async settle(delay = 30) {
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    async cleanup() {
        await this.cleanupActors([...this.actors]);
        this.actors.clear();
    }

    async cleanupActors(actors) {
        for (const actor of actors) {
            if (actor?.id) {
                await this.withTimeout(
                    actor.delete(),
                    2000,
                    `Timed out deleting PF2e test actor ${actor.id}`
                ).catch(error => console.warn("PF2e Rule Test cleanup", error));
            }
            this.actors.delete(actor);
        }
    }

    async report({ title = "PF2e Rule Element Tests" } = {}) {
        const failures = this.results.filter(result => !result.passed);
        const content = `
            <h2>${title}</h2>
            <p>${this.results.length - failures.length}/${this.results.length} passed</p>
            ${this.results.map(result => `
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
            `${title}: ${this.results.length - failures.length}/${this.results.length} passed`
        );
        console.table(this.results);
        return {
            passed: failures.length === 0,
            results: this.results
        };
    }
}

