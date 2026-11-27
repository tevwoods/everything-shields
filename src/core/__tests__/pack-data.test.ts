import fs from 'fs';
import path from 'path';

const packsDirectory = path.join(process.cwd(), 'packs', 'Everything-Shields');
const packFiles = fs.readdirSync(packsDirectory)
    .filter(file => file.endsWith('.json'))
    .sort();

describe('Shields compendium source data', () => {
    it.each(packFiles)('%s has valid PF2e 8.7 item and rule shapes', file => {
        const documents = JSON.parse(fs.readFileSync(path.join(packsDirectory, file), 'utf8'));

        expect(Array.isArray(documents)).toBe(true);
        expect(documents.length).toBeGreaterThan(0);
        expect(new Set(documents.map((document: any) => document._id)).size).toBe(documents.length);

        for (const document of documents) {
            expect(document._id).toMatch(/^[A-Za-z0-9]{16}$/);
            expect(document.type).not.toBe('item');

            for (const rule of document.system?.rules ?? []) {
                if (rule.predicate !== undefined) {
                    expect(Array.isArray(rule.predicate)).toBe(true);
                }
            }
        }
    });

    it.each(packFiles)('%s JSON and NEDB sources contain identical documents', file => {
        const jsonDocuments = JSON.parse(fs.readFileSync(path.join(packsDirectory, file), 'utf8'));
        const dbPath = path.join(packsDirectory, file.replace(/\.json$/, '.db'));
        const dbDocuments = fs.readFileSync(dbPath, 'utf8')
            .split(/\r?\n/)
            .filter(Boolean)
            .map(line => JSON.parse(line));

        expect(dbDocuments).toEqual(jsonDocuments);
    });

    it('uses PF2e effect item types in the effects pack', () => {
        const effects = JSON.parse(
            fs.readFileSync(path.join(packsDirectory, 'everything-shields-effects.json'), 'utf8')
        );
        expect(effects.every((effect: any) => effect.type === 'effect')).toBe(true);
    });

    it('uses native PF2e shield item fields', () => {
        const shields = JSON.parse(
            fs.readFileSync(path.join(packsDirectory, 'everything-shields-shields.json'), 'utf8')
        );
        for (const shield of shields) {
            expect(shield.type).toBe('shield');
            expect(shield.system.acBonus).toBeGreaterThan(0);
            expect(shield.system.bulk.value).toBeDefined();
            expect(shield.system.usage).toEqual({
                type: 'held',
                hands: 1,
                value: 'held-in-one-hand'
            });
            expect(shield.system.armor).toBeUndefined();
        }
    });

    it('uses current PF2e Rule Element paths and grant targets', () => {
        const read = (name: string) => JSON.parse(
            fs.readFileSync(path.join(packsDirectory, name), 'utf8')
        );
        const byName = (documents: any[], name: string) =>
            documents.find(document => document.name === name);

        const feats = read('everything-shields-general-feats.json');
        const runes = read('everything-shields-property-runes.json');

        const proficiency = byName(feats, 'Shield Proficiency');
        expect(proficiency.system.rules).toEqual([{
            key: 'MartialProficiency',
            definition: ['item:type:shield'],
            sameAs: 'unarmed',
            label: 'Shield Proficiency'
        }]);

        const shieldRaft = byName(feats, 'Shield Raft');
        expect(shieldRaft.system.rules[0].value.field)
            .toBe('actor|system.skills.athletics.rank');

        const medium = byName(feats, 'Medium Shield Specialization');
        expect(new Set(medium.system.rules.map((rule: any) => rule.uuid)).size).toBe(2);

        const anathematic = byName(feats, 'Anathematic Defense');
        const anathematicEffect = anathematic.system.rules
            .find((rule: any) => rule.key === 'ActiveEffectLike');
        expect(anathematicEffect.path).toBe('system.attributes.shield.hardness');
        expect(anathematicEffect.phase).toBe('afterDerived');

        const moonlit = byName(runes, 'Moonlit Shield Rune');
        expect(moonlit.system.rules[0].selector).toBe('low-light-vision');

        const spellguarding = byName(runes, 'Spellguarding Shield Rune');
        expect(spellguarding.system.rules[0].value)
            .toBe('{actor|system.attributes.shield.ac}');
    });

    it('keeps corrected PDF v6 mechanics and content', () => {
        const read = (name: string) => JSON.parse(
            fs.readFileSync(path.join(packsDirectory, name), 'utf8')
        );
        const byName = (documents: any[], name: string) =>
            documents.find(document => document.name === name);

        const feats = read('everything-shields-general-feats.json');
        const adjustments = read('everything-shields-adjustments.json');

        const practiced = byName(feats, 'Practiced Materials');
        expect(practiced.system.prerequisites.value.map((entry: any) => entry.value)).toEqual([
            'expert in Arcana, Nature, Occultism, or Religion'
        ]);
        expect(practiced.system.description.value).toContain('draw a scroll or wand');
        expect(practiced.system.actionType.value).toBe('free');

        const anathematic = byName(feats, 'Anathematic Defense');
        expect(anathematic.system.description.value).toContain('sanctification');
        expect(anathematic.system.description.value).toContain('Hardness is increased by 1');
        expect(anathematic.system.rules.some((rule: any) => rule.key === 'ChoiceSet')).toBe(false);
        expect(anathematic.system.rules.find((rule: any) => rule.key === 'ActiveEffectLike').value).toBe(1);

        const charismatic = byName(adjustments, 'Sentient Rune - Charismatic');
        const knowledgeable = byName(adjustments, 'Sentient Rune - Knowledgeable');
        expect(charismatic.system.description.value).toContain('<strong>Independent</strong>');
        expect(knowledgeable.system.description.value).toContain('<strong>Share Knowledge</strong>');
        expect(adjustments.some((document: any) => document.name.startsWith('Venom Pouch'))).toBe(false);

        const runes = read('everything-shields-property-runes.json');
        const trueUndead = byName(runes, 'Undead Shield Rune, True');
        expect(trueUndead.system.traits.rarity).toBe('rare');

        const greaterEnvironmental = byName(runes, 'Environmental Shield Rune, Greater');
        expect(greaterEnvironmental.system.description.value)
            .toContain('3rd-rank <em>environmental endurance</em>');
        expect(greaterEnvironmental.system.description.value)
            .toContain('severe cold or heat');
        expect(greaterEnvironmental.system.description.value)
            .not.toContain('severe hear or cold');

        const shields = read('everything-shields-shields.json');
        expect(byName(shields, 'Targe').system.description.value).toContain('close-quarters fighters');
        expect(byName(shields, 'Targe').system.traits.value).toContain('finesse');
        expect(byName(shields, 'Shield Gauntlet').system.traits.value).toContain('finesse');

        const kite = byName(shields, 'Kite Shield');
        const scutum = byName(shields, 'Scutum');
        const pavise = byName(shields, 'Pavise');
        expect(kite.system.rules.some((rule: any) => rule.option === 'deflecting-shield')).toBe(true);
        expect(scutum.system.baseItem).toBe('tower-shield');
        expect(pavise.system.baseItem).toBe('tower-shield');
        expect(scutum.system.speedPenalty).toBe(-5);
        expect(pavise.system.speedPenalty).toBe(-10);
        expect(scutum.system.rules.some((rule: any) => rule.slug === 'cumbersome-shield')).toBe(true);
        expect(pavise.system.rules.some((rule: any) => rule.slug === 'cumbersome-shield')).toBe(true);
        expect(kite.system.rules.some((rule: any) =>
            rule.option === 'intercepting-shield:magical-or-unarmed'
        )).toBe(false);
        expect(byName(runes, 'Heavy Shield Rune').system.rules).toEqual([]);

        const actions = read('everything-shields-actions.json');
        const intercepting = byName(actions, 'Intercepting Shield');
        expect(intercepting.system.requirements.value)
            .toContain('You have a light shield raised');
        expect(intercepting.system.trigger.value)
            .toContain('An ally within 15 feet is hit');
    });

    it('uses Remaster rank and condition wording in descriptions', () => {
        for (const file of packFiles) {
            const documents = JSON.parse(
                fs.readFileSync(path.join(packsDirectory, file), 'utf8')
            );
            for (const document of documents) {
                const description = document.system?.description?.value ?? '';
                expect(description).not.toMatch(/\b\d+(?:st|nd|rd|th)-level\b/i);
            }
        }

        const actions = JSON.parse(
            fs.readFileSync(path.join(packsDirectory, 'everything-shields-actions.json'), 'utf8')
        );
        const disrupting = actions.find((document: any) => document.name === 'Disrupting Shield');
        expect(disrupting.system.description.value).toContain('On a critical success');
        expect(disrupting.system.description.value).not.toContain('diffcult');

        const feats = JSON.parse(
            fs.readFileSync(path.join(packsDirectory, 'everything-shields-general-feats.json'), 'utf8')
        );
        const shieldSmash = feats.find((document: any) => document.name === 'Shield Smash');
        expect(shieldSmash.system.description.value).not.toContain('is Stupefied 2');
    });
});
