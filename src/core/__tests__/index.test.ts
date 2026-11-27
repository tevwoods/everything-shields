const initCallbacks = new Map<string, () => any>();
const eventCallbacks = new Map<string, (...args: any[]) => any>();

jest.mock('../settings', () => ({
    SettingsManager: (() => {
        const instance = { init: jest.fn() };
        return { getInstance: jest.fn(() => instance) };
    })()
}));

jest.mock('../shield-manager', () => ({
    ShieldManager: (() => {
        const instance = {
            removePropertyRune: jest.fn(),
            removeHardenedRune: jest.fn(),
            removePotencyRune: jest.fn(),
            applyDamage: jest.fn(),
            repair: jest.fn()
        };
        return { getInstance: jest.fn(() => instance) };
    })()
}));

jest.mock('../event-handler-manager', () => ({
    EventHandlerManager: (() => {
        const instance = {
            initialize: jest.fn(),
            cleanup: jest.fn(),
            handleUpdateItem: jest.fn(),
            handleDropActorSheetData: jest.fn(),
            handleBeforeItemCreation: jest.fn()
        };
        return { getInstance: jest.fn(() => instance) };
    })()
}));

jest.mock('../compendium-organizer', () => ({
    organizeCompendiums: jest.fn().mockResolvedValue(undefined)
}));

describe('module initialization and hooks', () => {
    beforeAll(() => {
        (global as any).Hooks = {
            once: jest.fn((name: string, callback: () => any) => initCallbacks.set(name, callback)),
            on: jest.fn((name: string, callback: (...args: any[]) => any) => eventCallbacks.set(name, callback))
        };
        (global as any).game = { pf2e: {} };
        (global as any).CONFIG = {
            PF2E: {
                shieldTraits: {},
                weaponTraits: {
                    finesse: 'Finesse'
                },
                Item: {
                    documentClasses: {
                        shield: class {
                            system = { hp: { max: 20, brokenThreshold: 10 }, hardness: 5 };
                            prepareBaseData() {}
                        }
                    }
                },
                traitsDescriptions: {
                    finesse: 'Finesse description'
                }
            }
        };
        (global as any).ui = { notifications: { error: jest.fn() } };
        require('../../index');
    });

    it('registers settings, setup APIs, ready behavior, and all document/drop hooks', async () => {
        expect(initCallbacks.has('init')).toBe(true);
        expect(initCallbacks.has('setup')).toBe(true);
        expect(initCallbacks.has('ready')).toBe(true);
        expect([...eventCallbacks.keys()].sort()).toEqual([
            'dropActorSheetData',
            'preCreateItem',
            'preUpdateItem',
            'updateItem'
        ]);

        initCallbacks.get('init')!();
        expect((global as any).CONFIG.PF2E.shieldTraits).toEqual(expect.objectContaining({
            finesse: 'Finesse',
            'shield-throw-15': 'ES.Trait.ShieldThrow15',
            'shield-throw-25': 'ES.Trait.ShieldThrow25'
        }));
        const ShieldClass = (global as any).CONFIG.PF2E.Item.documentClasses.shield;
        const preparedShield = new ShieldClass();
        (preparedShield as any).flags = {
            'everything-shields': {
                baseHP: 18,
                baseHardness: 5,
                potencyMultiplier: 3,
                materialModifier: 20,
                materialHardnessModifier: 5,
                hardenedBonus: 7
            }
        };
        preparedShield.prepareBaseData();
        expect(preparedShield.system.hp).toEqual({ max: 74, brokenThreshold: 37 });
        expect(preparedShield.system.hardness).toBe(17);
        initCallbacks.get('setup')!();
        initCallbacks.get('ready')!();
        await Promise.resolve();
        await Promise.resolve();

        const { SettingsManager } = require('../settings');
        const { EventHandlerManager } = require('../event-handler-manager');
        const { organizeCompendiums } = require('../compendium-organizer');
        const settingsInstance = SettingsManager.getInstance.mock.results[0].value;
        const eventInstance = EventHandlerManager.getInstance.mock.results[0].value;

        expect(settingsInstance.init).toHaveBeenCalled();
        expect(eventInstance.initialize).toHaveBeenCalled();
        expect(organizeCompendiums).toHaveBeenCalled();
        expect((global as any).game.pf2e.EverythingShields.RemovePotencyRune).toEqual(expect.any(Function));
        expect((global as any).game.pf2e.EverythingShields.ApplyDamage).toEqual(expect.any(Function));
        expect((global as any).game.pf2e.EverythingShields.Repair).toEqual(expect.any(Function));
    });

    it('routes public damage and repair APIs through the manager by actor and shield id', async () => {
        initCallbacks.get('setup')!();
        const { ShieldManager } = require('../shield-manager');
        const manager = ShieldManager.getInstance.mock.results[0].value;
        const shield = { id: 'shield-1' };
        (global as any).game.actors = {
            get: jest.fn(() => ({ items: { get: jest.fn(() => shield) } }))
        };

        await (global as any).game.pf2e.EverythingShields.ApplyDamage('actor-1', 'shield-1', 7);
        await (global as any).game.pf2e.EverythingShields.Repair('actor-1', 'shield-1', 3);

        expect(manager.applyDamage).toHaveBeenCalledWith(shield, 7);
        expect(manager.repair).toHaveBeenCalledWith(shield, 3);
    });

    it('rejects public damage and repair API calls for missing shields', async () => {
        initCallbacks.get('setup')!();
        (global as any).game.actors = {
            get: jest.fn(() => ({ items: { get: jest.fn(() => undefined) } }))
        };

        await expect(
            (global as any).game.pf2e.EverythingShields.ApplyDamage('actor-1', 'missing', 1)
        ).rejects.toThrow('Could not find shield with ID missing');
        await expect(
            (global as any).game.pf2e.EverythingShields.Repair('actor-1', 'missing', 1)
        ).rejects.toThrow('Could not find shield with ID missing');
    });

    it('registers cleanup through the disable hook', async () => {
        initCallbacks.get('ready')!();
        await Promise.resolve();
        const { EventHandlerManager } = require('../event-handler-manager');
        const eventInstance = EventHandlerManager.getInstance.mock.results[0].value;
        const disable = initCallbacks.get('disable');

        expect(disable).toEqual(expect.any(Function));
        disable!();
        expect(eventInstance.cleanup).toHaveBeenCalled();
    });

    it('removes HP changes before material automation and returns false for handled drops', async () => {
        const shield = { type: 'armor', system: { category: 'shield' } };
        const changes: any = { system: { preciousMaterial: { value: 'silver' }, hp: { max: 999 } } };

        eventCallbacks.get('preUpdateItem')!(shield, changes, {}, 'user-1');
        expect(changes.system.hp).toBeUndefined();

        const { EventHandlerManager } = require('../event-handler-manager');
        const eventInstance = EventHandlerManager.getInstance.mock.results[0].value;
        eventInstance.handleDropActorSheetData.mockReturnValue(true);
        expect(eventCallbacks.get('dropActorSheetData')!({}, {}, {})).toBe(false);
    });

    it('prevents rune creation when the event manager requests it', async () => {
        const { EventHandlerManager } = require('../event-handler-manager');
        const eventInstance = EventHandlerManager.getInstance.mock.results[0].value;
        eventInstance.handleBeforeItemCreation.mockResolvedValue(true);

        await expect(eventCallbacks.get('preCreateItem')!({}, {}, {}, 'user-1')).resolves.toBe(false);
    });
});
