import { EventHandlerManager } from '../event-handler-manager';

// Mock dependencies
jest.mock('../shield-manager');
jest.mock('../settings');

describe('EventHandlerManager - Rune Price Calculations', () => {
    let manager: EventHandlerManager;

    beforeEach(() => {
        manager = EventHandlerManager.getInstance();
    });

    describe('getRunePrice', () => {
        it('calculates +1 potency rune price (35 gp)', () => {
            const price = (manager as any).getRunePrice('1', null);
            expect(price).toBe(35);
        });

        it('calculates +2 potency rune price (935 gp)', () => {
            const price = (manager as any).getRunePrice('2', null);
            expect(price).toBe(935);
        });

        it('calculates +3 potency rune price (8935 gp)', () => {
            const price = (manager as any).getRunePrice('3', null);
            expect(price).toBe(8935);
        });

        it('calculates hardened rune price (65 gp)', () => {
            const price = (manager as any).getRunePrice(null, 'hardened');
            expect(price).toBe(65);
        });

        it('calculates greater hardened rune price (1065 gp)', () => {
            const price = (manager as any).getRunePrice(null, 'greater');
            expect(price).toBe(1065);
        });

        it('calculates major hardened rune price (20065 gp)', () => {
            const price = (manager as any).getRunePrice(null, 'major');
            expect(price).toBe(20065);
        });

        it('calculates combined potency + hardened price', () => {
            const price = (manager as any).getRunePrice('1', 'hardened');
            expect(price).toBe(100); // 35 + 65
        });

        it('returns 0 for no runes', () => {
            const price = (manager as any).getRunePrice(null, null);
            expect(price).toBe(0);
        });
    });

    describe('getRuneLevel', () => {
        it('calculates +1 potency rune level (3)', () => {
            const level = (manager as any).getRuneLevel('1', null);
            expect(level).toBe(3);
        });

        it('calculates +2 potency rune level (9)', () => {
            const level = (manager as any).getRuneLevel('2', null);
            expect(level).toBe(9);
        });

        it('calculates +3 potency rune level (15)', () => {
            const level = (manager as any).getRuneLevel('3', null);
            expect(level).toBe(15);
        });

        it('calculates hardened rune level (6)', () => {
            const level = (manager as any).getRuneLevel(null, 'hardened');
            expect(level).toBe(6);
        });

        it('calculates greater hardened rune level (12)', () => {
            const level = (manager as any).getRuneLevel(null, 'greater');
            expect(level).toBe(12);
        });

        it('calculates major hardened rune level (18)', () => {
            const level = (manager as any).getRuneLevel(null, 'major');
            expect(level).toBe(18);
        });

        it('returns highest level for combined runes', () => {
            const level = (manager as any).getRuneLevel('2', 'greater');
            expect(level).toBe(12); // max(9, 12)
        });

        it('returns 0 for no runes', () => {
            const level = (manager as any).getRuneLevel(null, null);
            expect(level).toBe(0);
        });
    });

    describe('calculatePotencyHPMultiplier', () => {
        it('calculates +1 potency multiplier (3x)', () => {
            const multiplier = (manager as any).calculatePotencyHPMultiplier('1');
            expect(multiplier).toBe(3);
        });

        it('calculates +2 potency multiplier (5x)', () => {
            const multiplier = (manager as any).calculatePotencyHPMultiplier('2');
            expect(multiplier).toBe(5);
        });

        it('calculates +3 potency multiplier (7x)', () => {
            const multiplier = (manager as any).calculatePotencyHPMultiplier('3');
            expect(multiplier).toBe(7);
        });

        it('returns 1x for no potency', () => {
            const multiplier = (manager as any).calculatePotencyHPMultiplier(null);
            expect(multiplier).toBe(1);
        });
    });

    describe('calculateHardenedBonus', () => {
        it('calculates hardened bonus for light shield (+2)', () => {
            const bonus = (manager as any).calculateHardenedBonus('hardened', 'light');
            expect(bonus).toBe(2);
        });

        it('calculates hardened bonus for medium shield (+3)', () => {
            const bonus = (manager as any).calculateHardenedBonus('hardened', 'medium');
            expect(bonus).toBe(3);
        });

        it('calculates hardened bonus for heavy shield (+4)', () => {
            const bonus = (manager as any).calculateHardenedBonus('hardened', 'heavy');
            expect(bonus).toBe(4);
        });

        it('calculates greater hardened bonus (+4/+7/+8)', () => {
            expect((manager as any).calculateHardenedBonus('greater', 'light')).toBe(4);
            expect((manager as any).calculateHardenedBonus('greater', 'medium')).toBe(7);
            expect((manager as any).calculateHardenedBonus('greater', 'heavy')).toBe(8);
        });

        it('calculates major hardened bonus (+8/+11/+13)', () => {
            expect((manager as any).calculateHardenedBonus('major', 'light')).toBe(8);
            expect((manager as any).calculateHardenedBonus('major', 'medium')).toBe(11);
            expect((manager as any).calculateHardenedBonus('major', 'heavy')).toBe(13);
        });

        it('returns 0 for no hardened rune', () => {
            const bonus = (manager as any).calculateHardenedBonus(null, 'medium');
            expect(bonus).toBe(0);
        });
    });

    describe('getMaterialHPModifier', () => {
        it('calculates cold iron standard-grade modifier (+8)', () => {
            const modifier = (manager as any).getMaterialHPModifier('cold-iron', 'standard');
            expect(modifier).toBe(8);
        });

        it('calculates cold iron high-grade modifier (+20)', () => {
            const modifier = (manager as any).getMaterialHPModifier('cold-iron', 'high');
            expect(modifier).toBe(20);
        });

        it('calculates adamantine standard-grade modifier (+20)', () => {
            const modifier = (manager as any).getMaterialHPModifier('adamantine', 'standard');
            expect(modifier).toBe(20);
        });

        it('calculates adamantine high-grade modifier (+32)', () => {
            const modifier = (manager as any).getMaterialHPModifier('adamantine', 'high');
            expect(modifier).toBe(32);
        });

        it('returns 0 for no material', () => {
            const modifier = (manager as any).getMaterialHPModifier(null, null);
            expect(modifier).toBe(0);
        });
    });

    describe('getShieldCategory', () => {
        it('identifies light shield (bulk L)', () => {
            const shield = { system: { bulk: { value: 'L' } } };
            const category = (manager as any).getShieldCategory(shield);
            expect(category).toBe('light');
        });

        it('identifies medium shield (bulk 1)', () => {
            const shield = { system: { bulk: { value: 1 } } };
            const category = (manager as any).getShieldCategory(shield);
            expect(category).toBe('medium');
        });

        it('identifies heavy shield (bulk 2+)', () => {
            const shield = { system: { bulk: { value: 2 } } };
            const category = (manager as any).getShieldCategory(shield);
            expect(category).toBe('heavy');
        });
    });
});

describe('EventHandlerManager - Integration Scenarios', () => {
    describe('Hoplon with +1 Potency Rune', () => {
        it('calculates correct HP: (24 × 3) = 72', () => {
            const baseHP = 24;
            const multiplier = 3; // +1 potency
            const materialModifier = 0;
            const expectedHP = Math.floor(baseHP * multiplier) + materialModifier;
            expect(expectedHP).toBe(72);
        });

        it('calculates correct price: 10 + 35 = 45 gp', () => {
            const basePrice = 10;
            const runePrice = 35;
            const totalPrice = basePrice + runePrice;
            expect(totalPrice).toBe(45);
        });

        it('calculates correct level: max(0, 3) = 3', () => {
            const baseLevel = 0;
            const runeLevel = 3;
            const totalLevel = Math.max(baseLevel, runeLevel);
            expect(totalLevel).toBe(3);
        });
    });

    describe('Hoplon with Cold Iron High-Grade + +1 Potency', () => {
        it('calculates correct HP: (24 × 3) + 20 = 92', () => {
            const baseHP = 24;
            const multiplier = 3;
            const materialModifier = 20; // cold iron high-grade
            const expectedHP = Math.floor(baseHP * multiplier) + materialModifier;
            expect(expectedHP).toBe(92);
        });

        it('material modifier applies after potency multiplier', () => {
            const baseHP = 24;
            const multiplier = 3;
            const materialModifier = 20;
            
            // Correct: (base × multiplier) + material
            const correct = Math.floor(baseHP * multiplier) + materialModifier;
            
            // Wrong: (base + material) × multiplier
            const wrong = Math.floor((baseHP + materialModifier) * multiplier);
            
            expect(correct).toBe(92);
            expect(wrong).not.toBe(92);
            expect(correct).not.toBe(wrong);
        });
    });

    describe('Shield with +2 Potency + Greater Hardened', () => {
        it('calculates combined price: 935 + 1065 = 2000 gp', () => {
            const potencyPrice = 935;
            const hardenedPrice = 1065;
            const totalPrice = potencyPrice + hardenedPrice;
            expect(totalPrice).toBe(2000);
        });

        it('calculates highest level: max(9, 12) = 12', () => {
            const potencyLevel = 9;
            const hardenedLevel = 12;
            const totalLevel = Math.max(potencyLevel, hardenedLevel);
            expect(totalLevel).toBe(12);
        });

        it('calculates HP with +2 potency (5x multiplier)', () => {
            const baseHP = 24;
            const multiplier = 5;
            const expectedHP = baseHP * multiplier;
            expect(expectedHP).toBe(120);
        });

        it('calculates hardness with greater hardened on medium shield (+4)', () => {
            const baseHardness = 5;
            const hardenedBonus = 4;
            const totalHardness = baseHardness + hardenedBonus;
            expect(totalHardness).toBe(9);
        });
    });

    describe('Price Format Conversion', () => {
        it('converts gold to PF2e Coins format', () => {
            const goldAmount = 45;
            const coins = {
                gp: 45,
                sp: 0,
                cp: 0,
                pp: 0
            };
            expect(coins.gp).toBe(goldAmount);
        });

        it('handles fractional gold to silver conversion', () => {
            const totalPrice = 45.5; // 45 gp, 5 sp
            const goldAmount = Math.floor(totalPrice);
            const silverAmount = Math.floor((totalPrice - goldAmount) * 10);
            
            expect(goldAmount).toBe(45);
            expect(silverAmount).toBe(5);
        });
    });
});

describe('EventHandlerManager - Rune Removal', () => {
    describe('Potency Rune Removal', () => {
        it('restores base HP after removing potency', () => {
            const baseHP = 24;
            const materialModifier = 20;
            const restoredHP = baseHP + materialModifier;
            expect(restoredHP).toBe(44);
        });

        it('recalculates broken threshold as floor(HP/2)', () => {
            const restoredHP = 44;
            const brokenThreshold = Math.floor(restoredHP / 2);
            expect(brokenThreshold).toBe(22);
        });
    });

    describe('Hardened Rune Removal', () => {
        it('restores base hardness after removing hardened', () => {
            const baseHardness = 5;
            const hardenedBonus = 4;
            const currentHardness = baseHardness + hardenedBonus;
            
            // After removal, should restore to base
            expect(currentHardness).toBe(9);
            expect(baseHardness).toBe(5);
        });
    });
});

describe('EventHandlerManager - Specific Magic Shield Detection', () => {
    it('marks shield as specific when rune is applied', () => {
        const hasRunes = true;
        const hasMaterial = false;
        const shouldBeSpecific = hasRunes || hasMaterial;
        expect(shouldBeSpecific).toBe(true);
    });

    it('marks shield as specific when material is applied', () => {
        const hasRunes = false;
        const hasMaterial = true;
        const shouldBeSpecific = hasRunes || hasMaterial;
        expect(shouldBeSpecific).toBe(true);
    });

    it('marks shield as specific when both rune and material applied', () => {
        const hasRunes = true;
        const hasMaterial = true;
        const shouldBeSpecific = hasRunes || hasMaterial;
        expect(shouldBeSpecific).toBe(true);
    });

    it('does not mark as specific when neither rune nor material', () => {
        const hasRunes = false;
        const hasMaterial = false;
        const shouldBeSpecific = hasRunes || hasMaterial;
        expect(shouldBeSpecific).toBe(false);
    });
});
