import {
    STURDY_SHIELD_SOURCE_IDS,
    WOVENWOOD_SHIELD_SOURCE_IDS,
    getMaterialBulkModifier,
    getMaterialLevel,
    getMaterialPrice,
    isGreaterOrEqualVersionOfRune,
    isLesserVersionOfRune,
    isSturdyOrWovenwoodShield,
    parseRuneVersion
} from '../../data/shield-constants';

describe('shield constants', () => {
    it('detects sturdy and wovenwood shields from all supported source fields', () => {
        const sturdyId = [...STURDY_SHIELD_SOURCE_IDS][0];
        const wovenwoodId = [...WOVENWOOD_SHIELD_SOURCE_IDS][0];

        expect(isSturdyOrWovenwoodShield({ flags: { core: { sourceId: sturdyId } } })).toBe(true);
        expect(isSturdyOrWovenwoodShield({ sourceId: wovenwoodId })).toBe(true);
        expect(isSturdyOrWovenwoodShield({ _stats: { compendiumSource: sturdyId } })).toBe(true);
        expect(isSturdyOrWovenwoodShield({ sourceId: 'not-protected' })).toBe(false);
    });

    it('parses versioned runes including parenthetical elements', () => {
        expect(parseRuneVersion('Energy-Resistant Shield Rune, Greater (Fire)')).toEqual({
            name: 'Energy-Resistant Shield Rune (Fire)',
            version: 'Greater'
        });
        expect(parseRuneVersion('Seeing Shield Rune')).toEqual({
            name: 'Seeing Shield Rune',
            version: ''
        });
    });

    it('compares rune versions only when the rune base and element match', () => {
        expect(isLesserVersionOfRune('Blocking Shield Rune', 'Blocking Shield Rune, Greater')).toBe(true);
        expect(isGreaterOrEqualVersionOfRune('Blocking Shield Rune, Major', 'Blocking Shield Rune, Greater')).toBe(true);
        expect(isGreaterOrEqualVersionOfRune('Blocking Shield Rune', 'Blocking Shield Rune, Greater')).toBe(false);
        expect(isLesserVersionOfRune('Blocking Shield Rune', 'Reflecting Shield Rune')).toBe(false);
    });

    it.each([
        ['cold-iron', 'high', 'light', 5000, 15],
        ['darkwood', 'standard', 'heavy', 560, 8],
        ['djezet', 'standard', 'medium', 660, 8],
        ['orichalcum', 'high', 'medium', 13200, 17],
        ['coldIron', 'standard', 'medium', 340, 7]
    ])('returns %s/%s material data by category', (material, grade, category, price, level) => {
        expect(getMaterialPrice(material, grade, category as any)).toBe(price);
        expect(getMaterialLevel(material, grade)).toBe(level);
    });

    it('returns material bulk modifiers and safe defaults', () => {
        expect(getMaterialBulkModifier('darkwood', 'high')).toBe(-1);
        expect(getMaterialBulkModifier('siccatite', 'standard')).toBe(1);
        expect(getMaterialBulkModifier('adamantine', 'standard')).toBe(0);
        expect(getMaterialPrice('unknown', 'high', 'heavy')).toBe(0);
        expect(getMaterialLevel('unknown', 'high')).toBe(0);
    });
});
