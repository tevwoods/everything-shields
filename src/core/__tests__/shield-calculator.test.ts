import { calculateShieldUpdates } from '../shield-calculator';
import type { Shield } from '../../types/shield';

describe('Shield Calculator - Name Generation', () => {
    const createTestShield = (overrides: any = {}): Shield => ({
        id: 's1',
        name: 'Hoplon',
        type: 'armor',
        system: {
            price: { value: 10 },
            description: { value: 'A sturdy shield' },
            hp: { value: 24, max: 24, brokenThreshold: 12 },
            hardness: 5,
            potencyRune: { value: null },
            resiliencyRune: { value: null },
            propertyRune1: { value: null },
            propertyRune2: { value: null },
            propertyRune3: { value: null },
            ...overrides.system
        },
        createEmbeddedDocuments: async () => Promise.resolve(),
        deleteEmbeddedDocuments: async () => Promise.resolve(),
        update: async () => Promise.resolve(),
        ...overrides
    });

    describe('Basic Naming', () => {
        it('returns base name when no runes', () => {
            const shield = createTestShield();
            const result = calculateShieldUpdates(shield);
            expect(result.name).toBe('Hoplon');
        });

        it('adds +1 potency to name', () => {
            const shield = createTestShield({
                system: { potencyRune: { value: '1' } }
            });
            const result = calculateShieldUpdates(shield);
            expect(result.name).toBe('+1 Hoplon');
        });

        it('adds +2 potency to name', () => {
            const shield = createTestShield({
                system: { potencyRune: { value: '2' } }
            });
            const result = calculateShieldUpdates(shield);
            expect(result.name).toBe('+2 Hoplon');
        });

        it('adds +3 potency to name', () => {
            const shield = createTestShield({
                system: { potencyRune: { value: '3' } }
            });
            const result = calculateShieldUpdates(shield);
            expect(result.name).toBe('+3 Hoplon');
        });
    });

    describe('Hardened Rune Naming', () => {
        it('adds Hardened to name', () => {
            const shield = createTestShield({
                system: { resiliencyRune: { value: 'hardened' } }
            });
            const result = calculateShieldUpdates(shield);
            expect(result.name).toBe('Hardened Hoplon');
        });

        it('adds Greater Hardened to name', () => {
            const shield = createTestShield({
                system: { resiliencyRune: { value: 'greater' } }
            });
            const result = calculateShieldUpdates(shield);
            expect(result.name).toBe('Greater Hardened Hoplon');
        });

        it('adds Major Hardened to name', () => {
            const shield = createTestShield({
                system: { resiliencyRune: { value: 'major' } }
            });
            const result = calculateShieldUpdates(shield);
            expect(result.name).toBe('Major Hardened Hoplon');
        });
    });

    describe('Combined Rune Naming', () => {
        it('combines potency and hardened: +1 Hardened', () => {
            const shield = createTestShield({
                system: {
                    potencyRune: { value: '1' },
                    resiliencyRune: { value: 'hardened' }
                }
            });
            const result = calculateShieldUpdates(shield);
            expect(result.name).toBe('+1 Hardened Hoplon');
        });

        it('combines potency and greater hardened: +2 Greater Hardened', () => {
            const shield = createTestShield({
                system: {
                    potencyRune: { value: '2' },
                    resiliencyRune: { value: 'greater' }
                }
            });
            const result = calculateShieldUpdates(shield);
            expect(result.name).toBe('+2 Greater Hardened Hoplon');
        });

        it('combines potency and major hardened: +3 Major Hardened', () => {
            const shield = createTestShield({
                system: {
                    potencyRune: { value: '3' },
                    resiliencyRune: { value: 'major' }
                }
            });
            const result = calculateShieldUpdates(shield);
            expect(result.name).toBe('+3 Major Hardened Hoplon');
        });
    });

    describe('Property Rune Naming', () => {
        it('adds single property rune to name', () => {
            const shield = createTestShield({
                system: {
                    potencyRune: { value: '1' },
                    propertyRune1: { value: 'blocking' }
                }
            });
            const result = calculateShieldUpdates(shield);
            expect(result.name).toContain('+1');
            expect(result.name).toContain('Blocking');
            expect(result.name).toContain('Hoplon');
        });

        it('adds multiple property runes to name', () => {
            const shield = createTestShield({
                system: {
                    potencyRune: { value: '2' },
                    propertyRune1: { value: 'blocking' },
                    propertyRune2: { value: 'reflecting' }
                }
            });
            const result = calculateShieldUpdates(shield);
            expect(result.name).toContain('+2');
            expect(result.name).toContain('Blocking');
            expect(result.name).toContain('Reflecting');
            expect(result.name).toContain('Hoplon');
        });

        it('removes "Shield Rune" suffix from property rune names', () => {
            const shield = createTestShield({
                system: {
                    potencyRune: { value: '1' },
                    propertyRune1: { value: 'Darkness Shield Rune' }
                }
            });
            const result = calculateShieldUpdates(shield);
            expect(result.name).toBe('+1 Darkness Hoplon');
            expect(result.name).not.toContain('Shield Rune');
        });

        it('removes "Rune" suffix from property rune names', () => {
            const shield = createTestShield({
                system: {
                    potencyRune: { value: '1' },
                    propertyRune1: { value: 'Blocking Rune' }
                }
            });
            const result = calculateShieldUpdates(shield);
            expect(result.name).toBe('+1 Blocking Hoplon');
            expect(result.name).not.toContain('Rune');
        });
    });

    describe('Name Pattern Order', () => {
        it('follows pattern: +X Greater/Major Hardened PropertyRune BaseName', () => {
            const shield = createTestShield({
                system: {
                    potencyRune: { value: '3' },
                    resiliencyRune: { value: 'major' },
                    propertyRune1: { value: 'reflecting' }
                }
            });
            const result = calculateShieldUpdates(shield);
            
            // Check order: +3 should come before Major, Major before Hardened, etc.
            const nameOrder = result.name || '';
            const potencyIndex = nameOrder.indexOf('+3');
            const majorIndex = nameOrder.indexOf('Major');
            const hardenedIndex = nameOrder.indexOf('Hardened');
            const propertyIndex = nameOrder.indexOf('Reflecting');
            const baseIndex = nameOrder.indexOf('Hoplon');
            
            expect(potencyIndex).toBeLessThan(majorIndex);
            expect(majorIndex).toBeLessThan(hardenedIndex);
            expect(hardenedIndex).toBeLessThan(propertyIndex);
            expect(propertyIndex).toBeLessThan(baseIndex);
        });
    });

    describe('Base Name Extraction', () => {
        it('extracts base name from "+1 Hoplon"', () => {
            const shield = createTestShield({
                name: '+1 Hoplon',
                system: { potencyRune: { value: '1' } }
            });
            const result = calculateShieldUpdates(shield);
            // Should rebuild name correctly
            expect(result.name).toBe('+1 Hoplon');
        });

        it('extracts base name from "+2 Greater Hardened Hoplon"', () => {
            const shield = createTestShield({
                name: '+2 Greater Hardened Hoplon',
                system: {
                    potencyRune: { value: '2' },
                    resiliencyRune: { value: 'greater' }
                }
            });
            const result = calculateShieldUpdates(shield);
            expect(result.name).toBe('+2 Greater Hardened Hoplon');
        });
    });
});

describe('Shield Calculator - Stats Calculation', () => {
    const createTestShield = (overrides: any = {}): Shield => ({
        id: 's1',
        name: 'Hoplon',
        type: 'armor',
        system: {
            price: { value: 10 },
            description: { value: 'A sturdy shield' },
            hp: { value: 24, max: 24, brokenThreshold: 12 },
            hardness: 5,
            potencyRune: { value: null },
            resiliencyRune: { value: null },
            ...overrides.system
        },
        createEmbeddedDocuments: async () => Promise.resolve(),
        deleteEmbeddedDocuments: async () => Promise.resolve(),
        update: async () => Promise.resolve(),
        ...overrides
    });

    describe('HP Calculations', () => {
        it('passes through current HP without changes', () => {
            const shield = createTestShield();
            const result = calculateShieldUpdates(shield);
            expect(result.hpMax).toBe(24);
        });
    });

    describe('Price Calculations', () => {
        it('passes through current price', () => {
            const shield = createTestShield();
            const result = calculateShieldUpdates(shield);
            expect(result.price).toBe(10);
        });
    });

    describe('Description Generation', () => {
        it('passes through description unchanged', () => {
            const shield = createTestShield();
            const result = calculateShieldUpdates(shield);
            expect(result.description).toBe('A sturdy shield');
        });
    });
});
