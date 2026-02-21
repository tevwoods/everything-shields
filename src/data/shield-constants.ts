/**
 * Source IDs for Sturdy Shields (from PF2e compendium).
 * These shields cannot have runes applied to them.
 */
export const STURDY_SHIELD_SOURCE_IDS: Set<string> = new Set([
    'Compendium.pf2e.equipment-srd.rrnWORxT2Ch4pUFb',
    'Compendium.pf2e.equipment-srd.nDZX25OwoN0Imrq6',
    'Compendium.pf2e.equipment-srd.BWQzaHbGVqlBuMww',
    'Compendium.pf2e.equipment-srd.f9ygr5Cjrmop8LWV',
    'Compendium.pf2e.equipment-srd.pNQJ9PTOEHxEZCgp',
    'Compendium.pf2e.equipment-srd.7Z8XXGiUiyyisKOD',
]);

/**
 * Source IDs for Wovenwood Shields (from PF2e compendium).
 * These shields cannot have runes applied to them.
 */
export const WOVENWOOD_SHIELD_SOURCE_IDS: Set<string> = new Set([
    'Compendium.pf2e.equipment-srd.Fr75q2wqO9AFG53z',
    'Compendium.pf2e.equipment-srd.LZAwOTKk3dKwsGDd',
    'Compendium.pf2e.equipment-srd.e9Xiei2wduOEGI5r',
    'Compendium.pf2e.equipment-srd.7jolv0cuttvjI1JD',
    'Compendium.pf2e.equipment-srd.nRLMg1NB2OSmzSqX',
    'Compendium.pf2e.equipment-srd.qXzP7yH72fxAChNU',
]);

/**
 * Check whether a shield is a Sturdy or Wovenwood shield by its source ID.
 * These shields have innate hardness/HP progressions and cannot accept runes.
 */
export function isSturdyOrWovenwoodShield(shield: any): boolean {
    const sourceId =
        shield.flags?.core?.sourceId ||
        shield.sourceId ||
        shield._stats?.compendiumSource ||
        '';
    return STURDY_SHIELD_SOURCE_IDS.has(sourceId) || WOVENWOOD_SHIELD_SOURCE_IDS.has(sourceId);
}

/**
 * Version hierarchy for property runes.
 * Higher value = higher tier.
 */
const VERSION_VALUES: Record<string, number> = {
    'Lesser': 0,
    '': 1,        // base (no qualifier)
    'Greater': 2,
    'Major': 3,
    'True': 4,
};

/**
 * Parse a property rune name into its base name and version tier.
 * E.g. "Energy-Resistant Shield Rune, Greater (Fire)" → { name: "Energy-Resistant Shield Rune (Fire)", version: "Greater" }
 * E.g. "Seeing Shield Rune" → { name: "Seeing Shield Rune", version: "" }
 */
export function parseRuneVersion(runeName: string): { name: string; version: string } {
    if (!runeName.includes(',')) {
        return { name: runeName, version: '' };
    }

    const parts = runeName.split(', ');
    const baseName = parts[0];
    const rest = parts.slice(1).join(', ');

    // Handle parenthetical element specifiers like "(Fire)"
    const parenIdx = rest.indexOf('(');
    if (parenIdx !== -1) {
        const closeIdx = rest.indexOf(')', parenIdx);
        const element = rest.substring(parenIdx, closeIdx + 1);
        const version = rest.substring(0, parenIdx).trim();
        return {
            name: `${baseName} ${element}`,
            version,
        };
    }

    return {
        name: baseName,
        version: rest.trim(),
    };
}

/**
 * Check if an existing rune is a lesser version of a new rune (same base, lower tier).
 * Returns true if `existingRuneName` is an inferior version of `newRuneName`,
 * meaning the new rune should replace it.
 */
export function isLesserVersionOfRune(existingRuneName: string, newRuneName: string): boolean {
    const existing = parseRuneVersion(existingRuneName);
    const incoming = parseRuneVersion(newRuneName);

    if (existing.name !== incoming.name) return false;

    const existingVal = VERSION_VALUES[existing.version] ?? -1;
    const incomingVal = VERSION_VALUES[incoming.version] ?? -1;

    return existingVal < incomingVal;
}

/**
 * Check if an existing rune is a greater (or equal) version of a new rune.
 * Returns true if the shield already has a superior or same version.
 */
export function isGreaterOrEqualVersionOfRune(existingRuneName: string, newRuneName: string): boolean {
    const existing = parseRuneVersion(existingRuneName);
    const incoming = parseRuneVersion(newRuneName);

    if (existing.name !== incoming.name) return false;

    const existingVal = VERSION_VALUES[existing.version] ?? -1;
    const incomingVal = VERSION_VALUES[incoming.version] ?? -1;

    return existingVal >= incomingVal;
}

/**
 * Precious material data: per-grade prices (by shield category), level, bulk modifier.
 * Prices are in gold pieces (gp).
 * The bulk field is a delta: -1 = reduce bulk by 1 step, +1 = increase bulk by 1 step.
 */
export interface MaterialGradeData {
    level: number;
    prices: { light: number; medium: number; heavy: number };
    bulk?: number; // bulk modifier delta (e.g. -1 for darkwood/mithral, +1 for siccatite)
}

export const PRECIOUS_MATERIAL_PRICES: Record<string, Record<string, MaterialGradeData>> = {
    abysium: {
        standard: { level: 8, prices: { light: 400, medium: 440, heavy: 440 } },
        high: { level: 16, prices: { light: 8000, medium: 8800, heavy: 8800 } },
    },
    adamantine: {
        standard: { level: 8, prices: { light: 400, medium: 440, heavy: 440 } },
        high: { level: 16, prices: { light: 8000, medium: 8800, heavy: 8800 } },
    },
    'cold-iron': {
        low: { level: 2, prices: { light: 30, medium: 34, heavy: 34 } },
        standard: { level: 7, prices: { light: 300, medium: 340, heavy: 340 } },
        high: { level: 15, prices: { light: 5000, medium: 5500, heavy: 5500 } },
    },
    darkwood: {
        standard: { level: 8, prices: { light: 400, medium: 440, heavy: 560 }, bulk: -1 },
        high: { level: 16, prices: { light: 8000, medium: 8800, heavy: 11200 }, bulk: -1 },
    },
    djezet: {
        standard: { level: 9, prices: { light: 600, medium: 660, heavy: 660 } },
        high: { level: 16, prices: { light: 8000, medium: 8800, heavy: 8800 } },
    },
    dragonhide: {
        standard: { level: 8, prices: { light: 400, medium: 440, heavy: 440 } },
        high: { level: 16, prices: { light: 8000, medium: 8800, heavy: 8800 } },
    },
    inubrix: {
        standard: { level: 8, prices: { light: 320, medium: 352, heavy: 352 } },
        high: { level: 16, prices: { light: 5000, medium: 5500, heavy: 5500 } },
    },
    mithral: {
        standard: { level: 8, prices: { light: 400, medium: 440, heavy: 440 }, bulk: -1 },
        high: { level: 16, prices: { light: 8000, medium: 8800, heavy: 8800 }, bulk: -1 },
    },
    noqual: {
        standard: { level: 8, prices: { light: 600, medium: 660, heavy: 660 } },
        high: { level: 16, prices: { light: 14000, medium: 15400, heavy: 15400 } },
    },
    orichalcum: {
        high: { level: 17, prices: { light: 12000, medium: 13200, heavy: 13200 } },
    },
    siccatite: {
        standard: { level: 8, prices: { light: 400, medium: 440, heavy: 440 }, bulk: 1 },
        high: { level: 16, prices: { light: 8000, medium: 8800, heavy: 8800 }, bulk: 1 },
    },
    silver: {
        low: { level: 2, prices: { light: 30, medium: 34, heavy: 34 } },
        standard: { level: 7, prices: { light: 300, medium: 340, heavy: 340 } },
        high: { level: 15, prices: { light: 5000, medium: 5500, heavy: 5500 } },
    },
};

/**
 * Property rune prices (in gp) and levels, keyed by rune name.
 * Note: many property rune prices are sourced from the Everything Shields supplement.
 */
export const PROPERTY_RUNE_PRICES: Record<string, { price: number; level: number }> = {
    // This will be populated from compendium data at runtime if needed.
    // The prices are stored in the compendium items themselves.
};

/**
 * Get the material price for a given material type, grade, and shield category.
 * Returns the price in gold pieces.
 */
export function getMaterialPrice(materialType: string, materialGrade: string, category: 'light' | 'medium' | 'heavy'): number {
    // Normalize material names: Foundry uses 'coldIron' or 'cold-iron'
    const normalizedType = materialType.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    const gradeData = PRECIOUS_MATERIAL_PRICES[normalizedType]?.[materialGrade];
    return gradeData?.prices?.[category] ?? 0;
}

/**
 * Get the material level for a given material type and grade.
 */
export function getMaterialLevel(materialType: string, materialGrade: string): number {
    const normalizedType = materialType.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    return PRECIOUS_MATERIAL_PRICES[normalizedType]?.[materialGrade]?.level ?? 0;
}

/**
 * Get the bulk modifier for a given material type and grade.
 * Returns 0 if no modifier, -1 for lighter materials, +1 for heavier materials.
 */
export function getMaterialBulkModifier(materialType: string, materialGrade: string): number {
    const normalizedType = materialType.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    return PRECIOUS_MATERIAL_PRICES[normalizedType]?.[materialGrade]?.bulk ?? 0;
}
