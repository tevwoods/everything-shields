jest.mock('../settings', () => ({
    SettingsManager: {
        getInstance: jest.fn(() => ({ getSetting: jest.fn() }))
    }
}));

jest.mock('../shield-effect-manager', () => ({
    ShieldEffectManager: {
        getInstance: jest.fn(() => ({
            applyDamage: jest.fn(),
            repair: jest.fn(),
            applyRuneEffect: jest.fn()
        }))
    }
}));

import { ShieldManager } from '../shield-manager';

describe('ShieldManager operations', () => {
    let manager: any;
    let settings: { getSetting: jest.Mock };
    let actor: any;
    let shield: any;
    let runePack: any;

    beforeEach(() => {
        (ShieldManager as any).instance = undefined;
        manager = ShieldManager.getInstance();
        settings = manager.settings;
        settings.getSetting.mockReturnValue(true);

        runePack = {
            index: [
                { _id: 'blocking', name: 'Blocking' },
                { _id: 'potency', name: '+1 Shield Potency Rune' },
                { _id: 'hardened', name: 'Hardened Rune, Greater' }
            ],
            getDocument: jest.fn(async (id: string) => ({
                toObject: () => ({ _id: id, name: id }
                )
            }))
        };

        shield = {
            id: 'shield-1',
            name: 'Blocking Hoplon',
            type: 'armor',
            system: {
                hp: { value: 48, max: 72, brokenThreshold: 36 },
                hardness: 12,
                price: { value: 45 },
                description: { value: '<p>Base</p>' },
                potencyRune: { value: '1' },
                resiliencyRune: { value: 'greater' },
                propertyRune1: { value: 'Blocking' },
                propertyRune2: { value: null },
                propertyRune3: { value: null },
                rules: [
                    { key: 'RuleA', _esRuneSource: 'Blocking' },
                    { key: 'RuleB', _esRuneSource: 'Other' }
                ]
            },
            flags: {
                'everything-shields': {
                    baseHP: 24,
                    baseHardness: 5,
                    materialModifier: 20,
                    baseShieldName: 'Hoplon'
                }
            },
            update: jest.fn().mockResolvedValue(undefined),
            parent: null,
            actor: null
        };

        actor = {
            id: 'actor-1',
            name: 'Test Actor',
            items: {
                find: (predicate: any) => predicate(shield) ? shield : undefined,
                get: jest.fn(() => shield)
            },
            createEmbeddedDocuments: jest.fn().mockResolvedValue([])
        };
        shield.parent = actor;
        shield.actor = actor;

        (global as any).game = {
            actors: { get: jest.fn(() => actor) },
            packs: { get: jest.fn(() => runePack) }
        };
        (global as any).fromUuid = jest.fn();
        (global as any).ui = { notifications: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } };
    });

    it('removes a property rune, its owned rules, and returns the rune to inventory', async () => {
        jest.spyOn(manager, 'updateShieldName').mockResolvedValue(undefined);
        jest.spyOn(manager, 'updateShieldDescription').mockResolvedValue(undefined);

        await manager.removePropertyRune({
            shieldParentId: 'actor-1',
            shieldId: 'shield-1',
            runeName: 'Blocking'
        });

        expect(shield.update).toHaveBeenCalledWith({ 'system.propertyRune1.value': null });
        expect(shield.update).toHaveBeenCalledWith({ 'system.rules': [{ key: 'RuleB', _esRuneSource: 'Other' }] });
        expect(runePack.getDocument).toHaveBeenCalledWith('blocking');
        expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [{ _id: 'blocking', name: 'blocking' }]);
        expect(manager.updateShieldName).toHaveBeenCalled();
        expect(manager.updateShieldDescription).toHaveBeenCalled();
    });

    it('removes potency with property-rune cascade and restores base HP plus material bonus', async () => {
        jest.spyOn(manager, 'updateShieldName').mockResolvedValue(undefined);
        jest.spyOn(manager, 'updateShieldDescription').mockResolvedValue(undefined);

        await manager.removePotencyRune({ shieldParentId: 'actor-1', shieldId: 'shield-1' });

        expect(shield.update).toHaveBeenCalledWith({
            'system.potencyRune.value': null,
            'system.propertyRune1.value': null,
            'system.propertyRune2.value': null,
            'system.propertyRune3.value': null,
            'system.hp.max': 44,
            'system.hp.brokenThreshold': 22,
            'flags.everything-shields.potencyMultiplier': null,
            'flags.everything-shields.isDivineAlly': null
        });
        expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(2);
        expect(ui.notifications.info).toHaveBeenCalledWith(expect.stringContaining('1 property rune'));
    });

    it('removes hardened runes and restores base hardness', async () => {
        jest.spyOn(manager, 'updateShieldName').mockResolvedValue(undefined);
        jest.spyOn(manager, 'updateShieldDescription').mockResolvedValue(undefined);

        await manager.removeHardenedRune({ shieldParentId: 'actor-1', shieldId: 'shield-1' });

        expect(shield.update).toHaveBeenCalledWith({
            'system.resiliencyRune.value': null,
            'system.hardness': 5,
            'flags.everything-shields.hardenedBonus': null
        });
        expect(runePack.getDocument).toHaveBeenCalledWith('hardened');
    });

    it('rejects potency and hardened rune effects when reinforcing mode is enabled', async () => {
        settings.getSetting.mockReturnValue(true);

        await manager.addRune(shield, 'potency', 1);
        await manager.addRune(shield, 'hardened', 1);

        expect(manager.effectManager.applyRuneEffect).not.toHaveBeenCalled();
        expect(ui.notifications.error).toHaveBeenCalledTimes(2);
    });

    it('applies allowed rune effects before persisting rune data', async () => {
        settings.getSetting.mockImplementation((key: string) =>
            key !== 'use-reinforcing-rune-instead-of-potency-and-hardened'
        );

        await manager.addRune(shield, 'reinforcing', 2);

        expect(manager.effectManager.applyRuneEffect).toHaveBeenCalledWith(shield, 'reinforcing', 2);
        expect(shield.update).toHaveBeenCalledWith({ 'system.runes.reinforcing': 2 });
    });

    it('delegates damage and repair to the effect manager', async () => {
        await manager.applyDamage(shield, 7);
        await manager.repair(shield, 3);

        expect(manager.effectManager.applyDamage).toHaveBeenCalledWith(shield, 7);
        expect(manager.effectManager.repair).toHaveBeenCalledWith(shield, 3);
    });

    it('reports missing parents and missing shields without throwing to the caller', async () => {
        (global as any).game.actors.get.mockReturnValue(undefined);
        (global as any).fromUuid.mockResolvedValue(undefined);

        await manager.removePropertyRune({
            shieldParentId: 'missing',
            shieldId: 'shield-1',
            runeName: 'Blocking'
        });

        expect(ui.notifications.error).toHaveBeenCalledWith(expect.stringContaining('missing'));
    });
});
