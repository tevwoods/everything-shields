import { ShieldEffectManager } from '../shield-effect-manager';

describe('ShieldEffectManager', () => {
    let manager: ShieldEffectManager;
    let shield: any;

    beforeEach(() => {
        manager = ShieldEffectManager.getInstance();
        shield = {
            id: 'shield-1',
            system: {
                hp: { value: 20, max: 20, brokenThreshold: 10 },
                hardness: 5,
                traits: { value: [] }
            },
            effects: [],
            createEmbeddedDocuments: jest.fn().mockResolvedValue([]),
            deleteEmbeddedDocuments: jest.fn().mockResolvedValue([])
            ,update: jest.fn().mockResolvedValue(undefined)
        };
        jest.spyOn(Date, 'now').mockReturnValue(1234);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it.each([
        ['potency', 2, 'system.runes.potency', 2],
        ['hardened', 2, 'system.hardness', 4],
    ])('creates the expected %s rune effect', async (runeType, value, key, expectedValue) => {
        await manager.applyRuneEffect(shield, runeType as string, value as number);

        const effect = shield.createEmbeddedDocuments.mock.calls[0][1][0];
        expect(effect.label).toMatch(new RegExp(runeType, 'i'));
        expect(effect.changes).toContainEqual(expect.objectContaining({ key, value: expectedValue }));
    });

    it('lets PF2e derive reinforcing HP and hardness from the rune field', async () => {
        await manager.applyRuneEffect(shield, 'reinforcing', 2);

        expect(shield.update).not.toHaveBeenCalled();
        expect(shield.createEmbeddedDocuments).not.toHaveBeenCalled();
    });

    it('updates HP at the broken threshold and leaves broken state to PF2e', async () => {
        await manager.applyDamage(shield, 10);

        expect(shield.update).toHaveBeenCalledWith({ 'system.hp.value': 10 });
        expect(shield.createEmbeddedDocuments).not.toHaveBeenCalled();
    });

    it('clamps damage at zero without producing negative HP', async () => {
        await manager.applyDamage(shield, 99);
        expect(shield.update).toHaveBeenCalledWith({ 'system.hp.value': 0 });
    });

    it('caps repairs at maximum HP and leaves broken state to PF2e', async () => {
        shield.system.hp.value = 8;
        shield.effects = [{ id: 'shield-1-broken' }];

        await manager.repair(shield, 30);

        expect(shield.update).toHaveBeenCalledWith({ 'system.hp.value': 20 });
        expect(shield.deleteEmbeddedDocuments).not.toHaveBeenCalled();
    });

    it('does not remove the broken effect while still at or below the threshold', async () => {
        shield.system.hp.value = 5;
        shield.effects = [{ id: 'shield-1-broken' }];

        await manager.repair(shield, 5);

        expect(shield.deleteEmbeddedDocuments).not.toHaveBeenCalled();
    });
});
