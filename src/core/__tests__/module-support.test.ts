import { organizeCompendiums } from '../compendium-organizer';
import { SettingsManager } from '../settings';
import { UpdateGuard } from '../update-guard';

describe('compendium organization', () => {
    beforeEach(() => {
        (global as any).Folder = { create: jest.fn() };
        (global as any).game = { folders: [], packs: [] };
    });

    it('reuses an existing populated Everything Shields folder', async () => {
        const pack = { metadata: { packageName: 'everything-shields' }, folder: { id: 'folder-1' }, setFolder: jest.fn() };
        (global as any).game.folders = [{ id: 'folder-1', type: 'Compendium', name: 'Everything Shields' }];
        (global as any).game.packs = [pack];

        await organizeCompendiums();

        expect((global as any).Folder.create).not.toHaveBeenCalled();
        expect(pack.setFolder).not.toHaveBeenCalled();
    });

    it('creates a folder and moves every module pack into it', async () => {
        const ownPacks = [
            { metadata: { packageName: 'everything-shields' }, setFolder: jest.fn() },
            { metadata: { packageName: 'everything-shields' }, setFolder: jest.fn() }
        ];
        const otherPack = { metadata: { packageName: 'pf2e' }, setFolder: jest.fn() };
        (global as any).game.packs = [...ownPacks, otherPack];
        (global as any).Folder.create.mockResolvedValue({ id: 'folder-2' });

        await organizeCompendiums();

        expect((global as any).Folder.create).toHaveBeenCalledWith({
            name: 'Everything Shields',
            type: 'Compendium',
            parent: null,
            color: '#FFA500'
        });
        expect(ownPacks[0].setFolder).toHaveBeenCalledWith('folder-2');
        expect(ownPacks[1].setFolder).toHaveBeenCalledWith('folder-2');
        expect(otherPack.setFolder).not.toHaveBeenCalled();
    });
});

describe('UpdateGuard', () => {
    beforeEach(() => {
        (UpdateGuard as any).updating.clear();
    });

    it('marks an update for its entire asynchronous duration and clears on failure', async () => {
        await expect(UpdateGuard.runExclusive('shield-1', async () => {
            expect(UpdateGuard.isUpdating('shield-1')).toBe(true);
            throw new Error('test failure');
        })).rejects.toThrow('test failure');

        expect(UpdateGuard.isUpdating('shield-1')).toBe(false);
    });

    it('allows nested work for the same id without deadlocking', async () => {
        await UpdateGuard.runExclusive('shield-1', async () => {
            await expect(UpdateGuard.runExclusive('shield-1', async () => 'nested')).resolves.toBe('nested');
        });
    });
});

describe('SettingsManager', () => {
    let register: jest.Mock;
    let get: jest.Mock;
    let set: jest.Mock;

    beforeEach(() => {
        register = jest.fn();
        get = jest.fn();
        set = jest.fn().mockResolvedValue(undefined);
        (global as any).ui = { notifications: { error: jest.fn() } };
        (global as any).game = { settings: { register, get, set } };
    });

    it('registers every automation setting with client scope and boolean type', () => {
        SettingsManager.getInstance().init();

        expect(register).toHaveBeenCalledTimes(6);
        for (const call of register.mock.calls) {
            expect(call[0]).toBe('everything-shields');
            expect(call[2]).toMatchObject({ scope: 'client', config: true, type: Boolean });
        }
    });

    it('reads and writes settings through the module namespace', async () => {
        get.mockReturnValue(true);
        const manager = SettingsManager.getInstance();

        expect(manager.getSetting<boolean>('disable-all-automations')).toBe(true);
        await manager.setSetting('disable-all-automations', false);

        expect(get).toHaveBeenCalledWith('everything-shields', 'disable-all-automations');
        expect(set).toHaveBeenCalledWith('everything-shields', 'disable-all-automations', false);
    });

    it('returns the complete settings config shape', () => {
        get.mockImplementation((_module: string, key: string) => key === 'disable-all-automations');

        expect(SettingsManager.getInstance().getConfig()).toEqual({
            shouldGenerateShieldNames: false,
            shouldCalculateShieldPrices: false,
            disableAllAutomations: true,
            shouldApplyRecommendedChangesToSpecificShields: false,
            shouldGenerateShieldDescriptions: false,
            useReinforcingRuneInsteadOfPotencyAndHardened: false
        });
    });

    it('reports registration, read, and write failures without throwing', async () => {
        register.mockImplementation(() => { throw new Error('register failed'); });
        get.mockImplementation(() => { throw new Error('get failed'); });
        set.mockRejectedValue(new Error('set failed'));
        const manager = SettingsManager.getInstance();

        expect(() => manager.init()).not.toThrow();
        expect(manager.getSetting('missing')).toBeUndefined();
        await expect(manager.setSetting('missing', true)).resolves.toBeUndefined();
        expect((global as any).ui.notifications.error).toHaveBeenCalledTimes(3);
    });
});
