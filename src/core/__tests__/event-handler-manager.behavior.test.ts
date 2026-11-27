import { EventHandlerManager } from '../event-handler-manager';

jest.mock('../shield-manager', () => ({
    ShieldManager: {
        getInstance: jest.fn(() => ({
            updateShieldName: jest.fn(),
            updateShieldDescription: jest.fn(),
            addRune: jest.fn(),
            removePropertyRune: jest.fn(),
            removeHardenedRune: jest.fn(),
            removePotencyRune: jest.fn()
        }))
    }
}));

jest.mock('../settings', () => ({
    SettingsManager: {
        getInstance: jest.fn(() => ({
            getSetting: jest.fn((key: string) =>
                key === 'should-calculate-shield-prices' ||
                key === 'should-apply-recommended-changes-to-specific-shields'
            )
        }))
    }
}));

describe('EventHandlerManager behavior', () => {
    let manager: any;
    let settings: { getSetting: jest.Mock };
    let shieldManager: any;
    let notifications: any;

    beforeEach(() => {
        (EventHandlerManager as any).instance = undefined;
        notifications = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
        (global as any).ui = { notifications };
        (global as any).game = {
            packs: { get: jest.fn() }
        };
        (global as any).randomID = () => 'random-id';
        (global as any).fromUuid = jest.fn();
        (global as any).Dialog = { confirm: jest.fn() };
        (global as any).window = global;

        manager = EventHandlerManager.getInstance();
        settings = manager.settings;
        shieldManager = manager.shieldManager;
    });

    it.each([
        ['shield', undefined, true],
        ['armor', 'shield', true],
        ['armor', 'light', false],
        ['weapon', undefined, false]
    ])('recognizes %s/%s as shield: %s', (type, category, expected) => {
        expect(manager.isShieldItem({ type, system: { category } })).toBe(expected);
    });

    it('skips all update automation when disabled or when the item is not actor-owned', async () => {
        settings.getSetting.mockReturnValueOnce(true);
        const materialChange = jest.spyOn(manager, 'handleMaterialChange').mockResolvedValue(undefined);
        const shield = { id: 's1', actor: {}, type: 'shield', system: {} };

        await manager.handleUpdateItem(shield, { 'system.preciousMaterial': { value: 'silver' } });
        settings.getSetting.mockReturnValue(false);
        await manager.handleUpdateItem({ ...shield, actor: null }, { 'system.preciousMaterial': { value: 'silver' } });

        expect(materialChange).not.toHaveBeenCalled();
        expect(shieldManager.updateShieldName).not.toHaveBeenCalled();
    });

    it('recalculates material changes and regenerates name/description for rune changes', async () => {
        const shield: any = {
            id: 's1',
            name: 'Hoplon',
            actor: {},
            type: 'armor',
            system: { category: 'shield', hp: { value: 20, max: 20 }, potencyRune: { value: '1' } }
        };
        const materialChange = jest.spyOn(manager, 'handleMaterialChange').mockResolvedValue(undefined);
        const priceUpdate = jest.spyOn(manager, 'updatePriceAndLevel').mockResolvedValue(undefined);

        await manager.handleUpdateItem(shield, {
            'system.preciousMaterial': { value: 'silver' },
            'system.potencyRune': { value: '1' }
        });

        expect(materialChange).toHaveBeenCalledWith(shield);
        expect(priceUpdate).toHaveBeenCalledWith(shield);
        expect(shieldManager.updateShieldName).toHaveBeenCalledWith(shield);
        expect(shieldManager.updateShieldDescription).toHaveBeenCalledWith(shield);
    });

    it('recalculates price and level for dotted property-rune updates', async () => {
        const shield: any = {
            id: 's1',
            name: 'Heater Shield',
            actor: {},
            type: 'shield',
            system: { category: 'shield' }
        };
        const priceUpdate = jest.spyOn(manager, 'updatePriceAndLevel').mockResolvedValue(undefined);

        await manager.handleUpdateItem(shield, {
            'system.propertyRune1.value': 'Living Shield Rune'
        });

        expect(priceUpdate).toHaveBeenCalledWith(shield);
    });

    it('preserves modern PF2e coin-object base prices', async () => {
        const shield: any = {
            name: 'Targe',
            system: {
                hp: { max: 4 },
                hardness: 1,
                bulk: { value: 'L' },
                price: { value: { sp: 2, gp: 0, cp: 0, pp: 0 } },
                level: { value: 0 },
                description: { value: 'Targe' }
            },
            flags: {},
            update: jest.fn().mockResolvedValue(undefined)
        };

        await manager.preserveInitialValues(shield);

        expect(shield.update).toHaveBeenCalledWith(expect.objectContaining({
            'flags.everything-shields.price': 0.2
        }));
    });

    it('computes material changes from preserved stats and updates HP, hardness, bulk, and flags', async () => {
        const shield: any = {
            id: 's1',
            system: {
                hp: { value: 100, max: 100, brokenThreshold: 50 },
                hardness: 8,
                bulk: { value: 1 },
                preciousMaterial: { value: 'cold-iron' },
                preciousMaterialGrade: { value: 'high' }
            },
            flags: {
                'everything-shields': {
                    baseHP: 20,
                    baseHardness: 5,
                    potencyMultiplier: 3,
                    hardenedBonus: 2,
                    bulk: 1
                }
            },
            update: jest.fn().mockResolvedValue(undefined)
        };
        jest.spyOn(manager, 'markAsSpecificMagicShield').mockResolvedValue(undefined);

        await manager.handleMaterialChange(shield);

        expect(shield.update).toHaveBeenCalledWith(expect.objectContaining({
            'system.hp.max': 80,
            'system.hp.brokenThreshold': 40,
            'system.hp.value': 80,
            'system.hardness': 12,
            'flags.everything-shields.materialModifier': 20,
            'flags.everything-shields.materialHardnessModifier': 5
        }), { everythingShieldsRecalculating: true });
    });

    it('applies material bulk modifiers and Divine Ally HP scaling', async () => {
        const shield: any = {
            id: 's1',
            system: {
                hp: { value: 20, max: 20, brokenThreshold: 10 },
                hardness: 5,
                bulk: { value: 2 },
                preciousMaterial: { value: 'darkwood' },
                preciousMaterialGrade: { value: 'high' }
            },
            flags: {
                'everything-shields': {
                    baseHP: 20,
                    baseHardness: 5,
                    potencyMultiplier: 1,
                    bulk: 2
                }
            },
            update: jest.fn().mockResolvedValue(undefined)
        };
        jest.spyOn(manager, 'getIsDivineAlly').mockReturnValue(true);
        jest.spyOn(manager, 'markAsSpecificMagicShield').mockResolvedValue(undefined);

        await manager.handleMaterialChange(shield);

        expect(shield.update).toHaveBeenCalledWith(expect.objectContaining({
            'system.hp.max': 60,
            'system.hp.brokenThreshold': 30,
            'system.bulk.value': 1,
            'flags.everything-shields.isDivineAlly': true
        }), { everythingShieldsRecalculating: true });
    });

    it('enables and clears the Intercepting Shield option for Djezet and Noqual', async () => {
        const shield: any = {
            id: 's1',
            system: {
                hp: { value: 18, max: 18 },
                hardness: 5,
                bulk: { value: 1 },
                rules: [],
                preciousMaterial: { value: 'djezet' },
                preciousMaterialGrade: { value: 'standard' }
            },
            flags: { 'everything-shields': { baseHP: 18, baseHardness: 5, bulk: 1 } },
            update: jest.fn().mockResolvedValue(undefined)
        };
        jest.spyOn(manager, 'markAsSpecificMagicShield').mockResolvedValue(undefined);

        await manager.handleMaterialChange(shield);

        expect(shield.update).toHaveBeenCalledWith(expect.objectContaining({
            'system.rules': [expect.objectContaining({
                key: 'RollOption',
                option: 'intercepting-shield:magical-or-unarmed'
            })]
        }), { everythingShieldsRecalculating: true });

        shield.system.preciousMaterial.value = 'silver';
        shield.system.preciousMaterialGrade.value = 'standard';
        shield.system.rules = shield.update.mock.calls[0][0]['system.rules'];
        shield.update.mockClear();

        await manager.handleMaterialChange(shield);

        expect(shield.update).toHaveBeenCalledWith(expect.objectContaining({
            'system.rules': []
        }), { everythingShieldsRecalculating: true });
    });

    it('applies potency and hardened rune effects from stored base values', async () => {
        const shield: any = {
            id: 's1',
            system: {
                hp: { value: 20, max: 20 },
                hardness: 5,
                bulk: { value: 1 },
                preciousMaterial: { value: 'adamantine' },
                preciousMaterialGrade: { value: 'standard' }
            },
            flags: { 'everything-shields': { baseHP: 20, baseHardness: 5 } },
            update: jest.fn().mockResolvedValue(undefined)
        };
        jest.spyOn(manager, 'getIsDivineAlly').mockReturnValue(false);

        await manager.applyPotencyRuneEffect(shield, '2');
        await manager.applyHardenedRuneEffect(shield, 'greater');

        expect(shield.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
            'system.hp.max': 120,
            'flags.everything-shields.potencyMultiplier': 5
        }));
        expect(shield.update).toHaveBeenNthCalledWith(2, expect.objectContaining({
            'system.hardness': 12,
            'flags.everything-shields.hardenedBonus': 7
        }));
    });

    it('preserves initial shield state only once and supports PF2e Coins prices', async () => {
        const shield: any = {
            name: 'Hoplon',
            system: {
                hp: { max: 24 },
                hardness: 5,
                bulk: { value: 1 },
                weight: { value: 1 },
                price: { value: { copperValue: 1000 } },
                level: { value: 0 },
                description: { value: '<p>Base</p>' }
            },
            flags: {},
            update: jest.fn().mockResolvedValue(undefined)
        };

        await manager.preserveInitialValues(shield);
        expect(shield.update).toHaveBeenCalledWith(expect.objectContaining({
            'flags.everything-shields.hitPoints': 24,
            'flags.everything-shields.price': 10,
            'flags.everything-shields.bulk': 1,
            'flags.everything-shields.description': '<p>Base</p>'
        }));

        shield.flags['everything-shields'] = { hitPoints: 24 };
        await manager.preserveInitialValues(shield);
        expect(shield.update).toHaveBeenCalledTimes(1);
    });

    it('updates price and level from base, fundamental runes, material, and property rune data', async () => {
        const shield: any = {
            system: {
                bulk: { value: 1 },
                potencyRune: { value: '1' },
                resiliencyRune: { value: 'hardened' },
                preciousMaterial: { value: 'cold-iron' },
                preciousMaterialGrade: { value: 'standard' },
                propertyRune1: { value: 'Blocking' },
                propertyRune2: { value: null },
                propertyRune3: { value: null }
            },
            flags: { 'everything-shields': { price: 10, level: 0 } },
            update: jest.fn().mockResolvedValue(undefined)
        };
        (global as any).game.packs.get.mockReturnValue({
            index: [{ _id: 'rune-1', name: 'Blocking' }],
            getDocument: jest.fn().mockResolvedValue({
                system: { price: { value: { gp: 5, sp: 5, cp: 0, pp: 0 } }, level: { value: 4 } }
            })
        });

        await manager.updatePriceAndLevel(shield);

        expect(shield.update).toHaveBeenCalledWith({
            'system.level.value': 7,
            'system.price.value': { gp: 455, sp: 5, cp: 0, pp: 0 },
            'system.price.per': 1,
            'flags.everything-shields.calculatedPrice': 455.5
        });
    });

    it('injects resolved property rune rules without copying ChoiceSet rules', async () => {
        const shield: any = {
            id: 's1',
            name: 'Hoplon',
            system: { rules: [{ key: 'Existing', slug: 'existing' }] },
            update: jest.fn().mockResolvedValue(undefined)
        };
        const rune = {
            system: {
                rules: [
                    { key: 'ChoiceSet', flag: 'element', choices: [{ label: 'Fire', value: 'fire' }] },
                    { key: 'Resistance', value: '{item|flags.pf2e.rulesSelections.element}', type: 'legacy' }
                ]
            }
        };
        jest.spyOn(manager, 'promptChoiceSetSelection').mockResolvedValue('fire');

        await manager.addRulesToShield(shield, rune, 'Energy-Resistant Shield Rune, Greater');

        const rules = shield.update.mock.calls[0][0]['system.rules'];
        expect(rules).toHaveLength(2);
        expect(rules[1]).toEqual({
            key: 'Resistance',
            value: 'fire',
            type: 'legacy',
            _esRuneSource: 'Energy-Resistant Shield Rune, Greater',
            slug: 'Resistance-energy-resistant-shield-rune--greater-random-id',
            requiresEquipped: true,
            requiresInvestment: false
        });
        expect(rules.some((rule: any) => rule.key === 'ChoiceSet')).toBe(false);
    });

    it('does not modify rules when ChoiceSet selection is cancelled', async () => {
        const shield = { name: 'Hoplon', system: { rules: [] }, update: jest.fn() };
        jest.spyOn(manager, 'promptChoiceSetSelection').mockResolvedValue(null);

        await manager.addRulesToShield(shield, {
            system: { rules: [{ key: 'ChoiceSet', choices: [{ label: 'Fire', value: 'fire' }] }] }
        }, 'Energy-Resistant');

        expect(shield.update).not.toHaveBeenCalled();
        expect(notifications.warn).toHaveBeenCalledWith(expect.stringContaining('Cancelled'));
    });

    it('rolls back a property slot when rule ChoiceSet selection is cancelled', async () => {
        const dialog = installDialogCapture();
        const shield = createMutableShield({
            system: { potencyRune: { value: '1' } }
        });
        const actor = createActor(shield);
        jest.spyOn(manager, 'addRulesToShield').mockResolvedValue(false);

        await manager.promptShieldSelectionAndApplyRune(
            actor,
            'Energy-Resistant Shield Rune',
            false,
            undefined,
            { system: { rules: [{ key: 'ChoiceSet' }] } }
        );
        await dialog.options.buttons.apply.callback(dialogHtml(shield.id));

        expect(shield.update).toHaveBeenCalledWith({ 'system.propertyRune1.value': 'Energy-Resistant Shield Rune' });
        expect(shield.update).toHaveBeenCalledWith({ 'system.propertyRune1.value': null });
        expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
    });

    it('removes only rules owned by the specified rune', async () => {
        const shield = {
            name: 'Hoplon',
            system: {
                rules: [
                    { key: 'A', _esRuneSource: 'Blocking' },
                    { key: 'B', _esRuneSource: 'Reflecting' }
                ]
            },
            update: jest.fn().mockResolvedValue(undefined)
        };

        await manager.removeRulesFromShield(shield, 'Blocking');

        expect(shield.update).toHaveBeenCalledWith({ 'system.rules': [{ key: 'B', _esRuneSource: 'Reflecting' }] });
    });

    it('applies abjuration, finesse, and category-specific thrown traits idempotently', async () => {
        const shield: any = {
            system: { bulk: { value: 2 }, traits: { value: ['existing'] } },
            update: jest.fn(async (data: any) => {
                shield.system.traits.value = data['system.traits.value'];
            })
        };

        await manager.applyPropertyRuneTraits(shield, 'Feather Shield Rune');
        await manager.applyPropertyRuneTraits(shield, 'Throwing Shield Rune');
        await manager.applyPropertyRuneTraits(shield, 'Throwing Shield Rune');

        expect(shield.system.traits.value).toEqual(expect.arrayContaining([
            'existing',
            'abjuration',
            'finesse',
            'shield-throw-15'
        ]));
        expect(shield.update).toHaveBeenCalledTimes(2);
    });

    it('marks a modified shield as specific magic and adds magical traits once', async () => {
        const shield: any = {
            id: 's1',
            system: {
                potencyRune: { value: '1' },
                resiliencyRune: { value: null },
                propertyRune1: { value: null },
                propertyRune2: { value: null },
                propertyRune3: { value: null },
                preciousMaterial: { value: null },
                traits: { value: [] },
                specific: { value: false },
                baseItem: null,
                slug: 'hoplon'
            },
            update: jest.fn().mockResolvedValue(undefined)
        };

        await manager.markAsSpecificMagicShield(shield);
        expect(shield.update).toHaveBeenCalledWith({
            'system.specific.value': true,
            'system.traits.value': ['magical'],
            'system.baseItem': 'hoplon'
        });
    });

    it('honors price and recommended-specific-shield automation settings', async () => {
        const shield: any = {
            system: {
                bulk: { value: 1 },
                potencyRune: { value: '1' },
                resiliencyRune: { value: null },
                propertyRune1: { value: null },
                propertyRune2: { value: null },
                propertyRune3: { value: null },
                preciousMaterial: { value: null },
                traits: { value: [] },
                specific: { value: false }
            },
            flags: { 'everything-shields': { price: 10, level: 0 } },
            update: jest.fn().mockResolvedValue(undefined)
        };
        settings.getSetting.mockImplementation((key: string) =>
            key !== 'should-calculate-shield-prices' &&
            key !== 'should-apply-recommended-changes-to-specific-shields'
        );

        await manager.updatePriceAndLevel(shield);
        await manager.markAsSpecificMagicShield(shield);

        expect(shield.update).toHaveBeenCalledTimes(1);
        expect(shield.update).toHaveBeenCalledWith({ 'system.level.value': 3 });
    });

    it('detects Shield Ally through the PF2e actor feat structure', () => {
        const shield = {
            parent: {
                feats: {
                    get: () => ({
                        feats: [{
                            feat: { name: 'Divine Ally' },
                            grants: [{ feat: { name: 'Shield Ally' } }]
                        }]
                    })
                }
            }
        };
        expect(manager.getIsDivineAlly(shield)).toBe(true);
        expect(manager.getIsDivineAlly({ parent: {} })).toBe(false);
    });

    it('intercepts compendium and inventory rune drops but ignores normal shields', async () => {
        const prompt = jest.spyOn(manager, 'promptShieldSelectionAndApplyRune').mockResolvedValue(undefined);
        const actor = { items: [] } as any;

        expect(manager.handleDropActorSheetData(actor, {} as any, {
            type: 'Item',
            uuid: 'Compendium.everything-shields.everything-shields-property-runes.Item.id'
        })).toBe(true);

        expect(manager.handleDropActorSheetData(actor, {} as any, {
            type: 'Item',
            uuid: '',
            data: { name: '+1 Shield Potency Rune', _id: 'r1', pack: 'everything-shields.property', type: 'equipment', system: { propertyRune: true } }
        })).toBe(true);

        expect(manager.handleDropActorSheetData(actor, {} as any, {
            type: 'Item',
            uuid: '',
            data: { type: 'armor', system: { category: 'shield' } }
        })).toBe(false);

        await Promise.resolve();
        await Promise.resolve();
        expect(prompt).toHaveBeenCalled();
    });

    it('blocks rune item creation only while a drop dialog is active', async () => {
        const runeItem = { name: '+1 Shield Potency Rune', type: 'equipment' };
        manager.isShowingRuneDialog = true;

        await expect(manager.handleBeforeItemCreation(runeItem, {})).resolves.toBe(true);

        settings.getSetting.mockReturnValue(true);
        await expect(manager.handleBeforeItemCreation(runeItem, {})).resolves.toBe(false);
    });

    it('routes description button confirmation to the correct removal operation', async () => {
        const classNames = [
            'everything-shields-button',
            'everything-shields-remove-potency-rune'
        ];
        const target = {
            classList: { contains: (name: string) => classNames.includes(name) },
            dataset: { shieldParentId: 'actor-1', shieldId: 'shield-1' }
        };
        (global as any).Dialog.confirm.mockResolvedValue(true);

        await manager.handleClick({ target });

        expect(shieldManager.removePotencyRune).toHaveBeenCalledWith({
            shieldParentId: 'actor-1',
            shieldId: 'shield-1'
        });
    });

    it.each([
        ['everything-shields-remove-property-rune', 'removePropertyRune', { shieldPropertyRuneName: 'Blocking' }],
        ['everything-shields-remove-hardened-rune', 'removeHardenedRune', {}],
        ['everything-shields-remove-potency-rune', 'removePotencyRune', {}]
    ])('routes confirmed %s clicks and honors cancellation', async (buttonClass, method, extraData) => {
        const target = {
            classList: {
                contains: (name: string) =>
                    name === 'everything-shields-button' || name === buttonClass
            },
            dataset: { shieldParentId: 'actor-1', shieldId: 'shield-1', ...extraData }
        };

        (global as any).Dialog.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        await manager.handleClick({ target });
        expect(shieldManager[method]).not.toHaveBeenCalled();

        await manager.handleClick({ target });
        expect(shieldManager[method]).toHaveBeenCalledTimes(1);
    });

    it('reports invalid removal buttons without calling a manager operation', async () => {
        const target = {
            classList: {
                contains: (name: string) =>
                    name === 'everything-shields-button' ||
                    name === 'everything-shields-remove-property-rune'
            },
            dataset: { shieldParentId: 'actor-1', shieldId: 'shield-1' }
        };

        await manager.handleClick({ target });

        expect(notifications.error).toHaveBeenCalledWith(expect.stringContaining('Missing property rune name'));
        expect(shieldManager.removePropertyRune).not.toHaveBeenCalled();
    });

    it('registers and removes the delegated click listener symmetrically', () => {
        const body = {
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        };
        (global as any).document = { body };

        manager.initialize();
        manager.cleanup();

        expect(body.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        expect(body.removeEventListener).toHaveBeenCalledWith('click', body.addEventListener.mock.calls[0][1]);
    });

    it('clears drop state after missing compendium UUID and keeps later drops usable', async () => {
        (global as any).fromUuid.mockResolvedValue(undefined);
        const actor = { items: [] } as any;

        expect(manager.handleDropActorSheetData(actor, {} as any, {
            type: 'Item',
            uuid: 'Compendium.everything-shields.everything-shields-property-runes.Item.missing'
        })).toBe(true);

        await Promise.resolve();
        await Promise.resolve();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(manager.isShowingRuneDialog).toBe(false);
        expect(notifications.error).toHaveBeenCalledWith('Could not find rune item.');

        const prompt = jest.spyOn(manager, 'promptShieldSelectionAndApplyRune').mockResolvedValue(undefined);
        manager.handleDropActorSheetData(actor, {} as any, {
            type: 'Item',
            uuid: '',
            data: { name: '+1 Shield Potency Rune', _id: 'r1', type: 'equipment', pack: 'everything-shields', system: { propertyRune: true } }
        });
        await Promise.resolve();
        await Promise.resolve();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(prompt).toHaveBeenCalled();
    });

    it('returns a cancelled compendium drop to inventory when no shield exists', async () => {
        const actor = {
            items: [],
            createEmbeddedDocuments: jest.fn().mockResolvedValue([])
        } as any;
        (global as any).fromUuid.mockResolvedValue({
            name: 'Living Shield Rune',
            toObject: () => ({ name: 'Living Shield Rune', type: 'equipment' })
        });

        manager.handleDropActorSheetData(actor, {} as any, {
            type: 'Item',
            uuid: 'Compendium.everything-shields.everything-shields-property-runes.Item.rune'
        });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
            { name: 'Living Shield Rune', type: 'equipment' }
        ]);
        expect(notifications.warn).toHaveBeenCalledWith('No shields found in inventory to apply the rune.');
    });

    it('resolves rune data from inventory, provided data, and compendium fallback', async () => {
        const inventoryRune = { id: 'inventory-rune', toObject: () => ({ system: { rules: [] } }) };
        const actor = { items: { get: jest.fn<any, any[]>(() => inventoryRune) } };
        const provided = { system: { rules: [{}] } };
        const fallback = { system: { rules: [{}] }, toObject: () => ({ system: { rules: [{}] }, from: 'pack' }) };
        const pack = {
            getIndex: jest.fn().mockResolvedValue([{ _id: 'id', name: 'Rune' }]),
            getDocument: jest.fn().mockResolvedValue(fallback)
        };
        (global as any).game.packs.get.mockReturnValue(pack);

        await expect(manager.getRuneItemData(actor, 'Rune', 'id', provided)).resolves.toBe(provided);
        await expect(manager.getRuneItemData(actor, 'Rune', 'id')).resolves.toEqual(inventoryRune.toObject());

        actor.items.get.mockReturnValue(undefined);
        await expect(manager.getRuneItemData(actor, 'Rune', 'missing')).resolves.toEqual(fallback.toObject());
        expect(pack.getDocument).toHaveBeenCalledWith('id');
    });

    it('detects and scales Divine Ally only for the matching granted Shield Ally feature', async () => {
        const noGrant = {
            parent: {
                feats: {
                    get: () => ({ feats: [{ feat: { name: 'Divine Ally' }, grants: [] }] })
                }
            }
        };
        expect(manager.getIsDivineAlly(noGrant)).toBe(false);

        const shield: any = {
            id: 's1',
            system: {
                hp: { value: 18, max: 18 },
                hardness: 5,
                preciousMaterial: { value: null },
                preciousMaterialGrade: { value: null }
            },
            flags: { 'everything-shields': { baseHP: 18 } },
            update: jest.fn().mockResolvedValue(undefined),
            parent: {
                feats: {
                    get: () => ({
                        feats: [{
                            feat: { name: 'Divine Ally' },
                            grants: [{ feat: { name: 'Shield Ally' } }]
                        }]
                    })
                }
            }
        };

        await manager.applyPotencyRuneEffect(shield, '1');
        expect(shield.update).toHaveBeenCalledWith(expect.objectContaining({
            'system.hp.max': 81,
            'system.hp.brokenThreshold': 40,
            'flags.everything-shields.isDivineAlly': true
        }));
    });

    it('applies a fundamental potency rune from inventory through the selection dialog', async () => {
        const dialog = installDialogCapture();
        const shield = createMutableShield({
            id: 'shield-1',
            name: 'Hoplon',
            flags: {},
            system: {
                hp: { value: 24, max: 24, brokenThreshold: 12 },
                hardness: 5,
                bulk: { value: 1 },
                price: { value: 10 },
                level: { value: 0 },
                description: { value: '<p>Base</p>' },
                traits: { value: [] },
                specific: { value: false },
                potencyRune: { value: null },
                resiliencyRune: { value: null },
                propertyRune1: { value: null },
                propertyRune2: { value: null },
                propertyRune3: { value: null }
            }
        });
        const actor = createActor(shield);
        jest.spyOn(manager, 'applyPotencyRuneEffect').mockResolvedValue(undefined);
        jest.spyOn(manager, 'updatePriceAndLevel').mockResolvedValue(undefined);

        await manager.promptShieldSelectionAndApplyRune(
            actor,
            '+1 Shield Potency Rune',
            true,
            'rune-source'
        );
        await dialog.options.buttons.apply.callback(dialogHtml('shield-1'));

        expect(shield.system.potencyRune.value).toBe('1');
        expect(shield.flags['everything-shields'].hitPoints).toBe(24);
        expect(shield.system.traits.value).toContain('invested');
        expect(shield.system.traits.value).toContain('magical');
        expect(shield.system.specific.value).toBe(true);
        expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['rune-source']);
        expect(manager.applyPotencyRuneEffect).toHaveBeenCalledWith(shield, '1');
    });

    it('blocks rune application to sturdy and wovenwood shields', async () => {
        const dialog = installDialogCapture();
        const protectedId = 'Compendium.pf2e.equipment-srd.rrnWORxT2Ch4pUFb';
        const shield = createMutableShield({
            flags: { core: { sourceId: protectedId } }
        });
        const actor = createActor(shield);

        await manager.promptShieldSelectionAndApplyRune(actor, '+1 Shield Potency Rune', true);
        await dialog.options.buttons.apply.callback(dialogHtml('shield-1'));

        expect(shield.update).not.toHaveBeenCalled();
        expect(dialog.rendered).toContain(true);
        expect(notifications.info).not.toHaveBeenCalledWith(expect.stringContaining('Added'));
    });

    it('rejects a property rune when the shield has no potency rune or slots are full', async () => {
        const noPotencyDialog = installDialogCapture();
        const noPotencyShield = createMutableShield();
        const noPotencyActor = createActor(noPotencyShield);

        await manager.promptShieldSelectionAndApplyRune(noPotencyActor, 'Blocking', false);
        await noPotencyDialog.options.buttons.apply.callback(dialogHtml('shield-1'));

        expect(notifications.warn).toHaveBeenCalledWith(expect.stringContaining('must have a shield potency rune'));

        const fullDialog = installDialogCapture();
        const fullShield = createMutableShield({
            system: {
                potencyRune: { value: '1' },
                propertyRune1: { value: 'Blocking' }
            }
        });
        const fullActor = createActor(fullShield);

        await manager.promptShieldSelectionAndApplyRune(fullActor, 'Reflecting', false);
        await fullDialog.options.buttons.apply.callback(dialogHtml('shield-1'));

        expect(notifications.warn).toHaveBeenCalledWith(expect.stringContaining('All 1 property rune slot'));
    });

    it('upgrades a property rune in place, removes old rules, and returns the replaced rune', async () => {
        const dialog = installDialogCapture();
        const shield = createMutableShield({
            system: {
                potencyRune: { value: '2' },
                propertyRune1: { value: 'Reflecting Shield Rune' },
                propertyRune2: { value: null },
                rules: [{ key: 'Resistance', _esRuneSource: 'Reflecting Shield Rune' }]
            }
        });
        const actor = createActor(shield);
        jest.spyOn(manager, 'removeRulesFromShield').mockResolvedValue(undefined);
        jest.spyOn(manager, 'addRulesToShield').mockResolvedValue(true);
        jest.spyOn(manager, 'returnRuneToInventory').mockResolvedValue(undefined);

        await manager.promptShieldSelectionAndApplyRune(
            actor,
            'Reflecting Shield Rune, Greater',
            false,
            'greater-rune',
            { system: { rules: [] } }
        );
        await dialog.options.buttons.apply.callback(dialogHtml('shield-1'));

        expect(shield.system.propertyRune1.value).toBe('Reflecting Shield Rune, Greater');
        expect(manager.removeRulesFromShield).toHaveBeenCalledWith(shield, 'Reflecting Shield Rune');
        expect(manager.returnRuneToInventory).toHaveBeenCalledWith(actor, 'Reflecting Shield Rune', false);
        expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['greater-rune']);
        expect(notifications.info).toHaveBeenCalledWith(expect.stringContaining('Upgraded'));
    });

    it('returns a cancelled compendium rune to inventory but leaves an inventory rune untouched', async () => {
        const compendiumDialog = installDialogCapture();
        const actor = createActor(createMutableShield());
        const runeData = { name: 'Blocking', type: 'equipment', system: {} };

        await manager.promptShieldSelectionAndApplyRune(actor, 'Blocking', false, undefined, runeData);
        await compendiumDialog.options.buttons.cancel.callback();

        expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [runeData]);

        actor.createEmbeddedDocuments.mockClear();
        const inventoryDialog = installDialogCapture();
        await manager.promptShieldSelectionAndApplyRune(actor, 'Blocking', false, 'source-1', runeData);
        await inventoryDialog.options.buttons.cancel.callback();

        expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
    });

    function createActor(shield: any): any {
        const items: any[] = [shield];
        (items as any).get = jest.fn((id: string) => items.find(item => item.id === id));
        const actor = {
            name: 'Test Actor',
            items,
            createEmbeddedDocuments: jest.fn().mockResolvedValue([]),
            deleteEmbeddedDocuments: jest.fn().mockResolvedValue([])
        };
        shield.parent = actor;
        shield.actor = actor;
        return actor;
    }

    function createMutableShield(overrides: any = {}): any {
        const base = {
            id: 'shield-1',
            name: 'Hoplon',
            type: 'armor',
            system: {
                category: 'shield',
                hp: { value: 24, max: 24, brokenThreshold: 12 },
                hardness: 5,
                bulk: { value: 1 },
                price: { value: 10 },
                level: { value: 0 },
                description: { value: '<p>Base</p>' },
                traits: { value: [] },
                specific: { value: false },
                potencyRune: { value: null },
                resiliencyRune: { value: null },
                propertyRune1: { value: null },
                propertyRune2: { value: null },
                propertyRune3: { value: null },
                rules: []
            },
            flags: {},
            update: jest.fn()
        };
        const shield: any = {
            ...base,
            ...overrides,
            system: {
                ...base.system,
                ...(overrides.system || {}),
                hp: overrides.system?.hp || base.system.hp,
                traits: overrides.system?.traits || base.system.traits,
                potencyRune: overrides.system?.potencyRune || base.system.potencyRune,
                resiliencyRune: overrides.system?.resiliencyRune || base.system.resiliencyRune,
                propertyRune1: overrides.system?.propertyRune1 || base.system.propertyRune1,
                propertyRune2: overrides.system?.propertyRune2 || base.system.propertyRune2,
                propertyRune3: overrides.system?.propertyRune3 || base.system.propertyRune3,
                rules: overrides.system?.rules || base.system.rules
            },
            flags: overrides.flags || base.flags
        };
        shield.update.mockImplementation(async (changes: Record<string, any>) => {
            for (const [path, value] of Object.entries(changes)) {
                const parts = path.split('.');
                let target = shield;
                for (const part of parts.slice(0, -1)) {
                    target[part] ||= {};
                    target = target[part];
                }
                target[parts[parts.length - 1]] = value;
            }
        });
        return shield;
    }

    function dialogHtml(shieldId: string): any {
        return {
            find: (selector: string) => {
                expect(selector).toBe('#shield-select');
                return { val: () => shieldId };
            }
        };
    }

    function installDialogCapture(): any {
        const captured: any = { rendered: [] };
        const DialogConstructor: any = jest.fn(function (this: any, options: any) {
            captured.options = options;
            this.render = jest.fn((force: boolean) => captured.rendered.push(force));
            return this;
        });
        (global as any).window.Dialog = DialogConstructor;
        return captured;
    }
});
