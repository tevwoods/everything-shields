import { EventHandlerManager } from './core/event-handler-manager';
import { SettingsManager } from './core/settings';
import { ShieldManager } from './core/shield-manager';
import { handleError } from './core/errors';
import { organizeCompendiums } from './core/compendium-organizer';

// Module initialization
Hooks.once('init', () => {
    console.log('Everything Shields | Initializing module');
    try {
        const pf2e = (globalThis as any).CONFIG.PF2E;
        Object.assign(pf2e.shieldTraits, {
            finesse: pf2e.weaponTraits.finesse,
            'shield-throw-15': 'ES.Trait.ShieldThrow15',
            'shield-throw-25': 'ES.Trait.ShieldThrow25'
        });
        Object.assign(pf2e.traitsDescriptions, {
            finesse: pf2e.traitsDescriptions.finesse,
            'shield-throw-15': 'ES.TraitDescription.ShieldThrow',
            'shield-throw-25': 'ES.TraitDescription.ShieldThrow'
        });
        const ShieldClass = pf2e.Item?.documentClasses?.shield;
        if (ShieldClass && !ShieldClass.prototype.__everythingShieldsPrepared) {
            const prepareBaseData = ShieldClass.prototype.prepareBaseData;
            ShieldClass.prototype.prepareBaseData = function() {
                prepareBaseData.call(this);
                const flags = (this as any).flags?.['everything-shields'];
                if (!flags?.baseHP || !flags?.baseHardness) return;

                const hpMultiplier = flags.potencyMultiplier ?? 1;
                const divineAllyMultiplier = flags.isDivineAlly ? 1.5 : 1;
                this.system.hp.max = Math.floor(
                    (Math.floor(flags.baseHP * hpMultiplier) + (flags.materialModifier ?? 0)) *
                    divineAllyMultiplier
                );
                this.system.hp.brokenThreshold = Math.floor(this.system.hp.max / 2);
                this.system.hardness =
                    flags.baseHardness +
                    (flags.materialHardnessModifier ?? 0) +
                    (flags.hardenedBonus ?? 0);
            };
            ShieldClass.prototype.__everythingShieldsPrepared = true;
        }
        // Initialize settings first
        const settings = SettingsManager.getInstance();
        settings.init();
    } catch (error) {
        handleError(error as Error);
    }
});

// Setup hook - runs after init but before ready
Hooks.once('setup', () => {
    console.log('Everything Shields | Setting up module');
    try {
        // Register the shield manager's API functions on the game object
        const shieldManager = ShieldManager.getInstance();
        game.pf2e.EverythingShields = {
            RemovePropertyRune: (shieldParentId: string, shieldId: string, runeName: string) => 
                shieldManager.removePropertyRune({ shieldParentId, shieldId, runeName }),
            RemoveHardenedRune: (shieldParentId: string, shieldId: string) => 
                shieldManager.removeHardenedRune({ shieldParentId, shieldId }),
            RemovePotencyRune: (shieldParentId: string, shieldId: string) => 
                shieldManager.removePotencyRune({ shieldParentId, shieldId }),
            ApplyDamage: async (shieldParentId: string, shieldId: string, damage: number) => {
                const actor = game.actors?.get(shieldParentId);
                const shield = actor?.items.get(shieldId);
                if (!shield) throw new Error(`Could not find shield with ID ${shieldId}`);
                return shieldManager.applyDamage(shield as any, damage);
            },
            Repair: async (shieldParentId: string, shieldId: string, amount: number) => {
                const actor = game.actors?.get(shieldParentId);
                const shield = actor?.items.get(shieldId);
                if (!shield) throw new Error(`Could not find shield with ID ${shieldId}`);
                return shieldManager.repair(shield as any, amount);
            }
        };
    } catch (error) {
        handleError(error as Error);
    }
});

// Ready hook - runs when core initialization is ready and game data is available
Hooks.once('ready', () => {
    console.log('Everything Shields | Module ready');
    try {
        const setup = async () => {
            // Initialize event handlers
            const eventManager = EventHandlerManager.getInstance();
            eventManager.initialize();

            // Register cleanup for when the module is disabled
            Hooks.once('disable', () => {
                eventManager.cleanup();
            });

            // Organize compendium packs
            try {
                await organizeCompendiums();
            } catch (error) {
                console.warn('Everything Shields | Failed to organize compendiums:', error);
            }
        };

        setup().catch(error => handleError(error as Error));
    } catch (error) {
        handleError(error as Error);
    }
});

import { Item, Actor, ActorSheet, DragData, UpdateData, DocumentModificationContext } from './types/foundry-types';

// Register event hooks
Hooks.on('preUpdateItem', (
    item: Item,
    changes: UpdateData,
    options: DocumentModificationContext,
    userId: string
) => {
    try {
        const itemAny = item as any;
        // Only process shields with material changes
        if ((itemAny.type === 'shield' || (itemAny.type === 'armor' && itemAny.system?.category === 'shield'))) {
            const hasMaterialChange = changes['system.preciousMaterial'] ||
                                     changes['system.preciousMaterialGrade'] ||
                                     changes['system.material'] || 
                                     (changes.system && ((changes.system as any).preciousMaterial || (changes.system as any).preciousMaterialGrade || (changes.system as any).material));
            if (hasMaterialChange && !options.everythingShieldsRecalculating) {
                console.log('preUpdateItem - Material change detected, intercepting HP change');
                if (!(itemAny.flags?.['everything-shields']?.baseHP)) {
                    if (itemAny.system.hp?.max !== undefined) {
                        changes['flags.everything-shields.baseHP'] = itemAny.system.hp.max;
                    }
                }
                if (!(itemAny.flags?.['everything-shields']?.baseHardness)) {
                    if (itemAny.system.hardness !== undefined) {
                        changes['flags.everything-shields.baseHardness'] = itemAny.system.hardness;
                    }
                }
                // Remove HP changes from the update - we'll recalculate them
                if (changes.system && (changes.system as any).hp) {
                    delete (changes.system as any).hp;
                }
            }
        }
    } catch (error) {
        handleError(error as Error);
    }
});

Hooks.on('updateItem', async (
    item: Item,
    changes: UpdateData,
    options: DocumentModificationContext,
    userId: string
) => {
    try {
        console.log('updateItem hook fired:', { itemName: (item as any).name, itemType: item.type, changes });
        await EventHandlerManager.getInstance().handleUpdateItem(item, changes, options);
    } catch (error) {
        handleError(error as Error);
    }
});

Hooks.on('dropActorSheetData', (
    actor: Actor,
    sheet: ActorSheet,
    dragData: DragData
) => {
    try {
        const handled = EventHandlerManager.getInstance().handleDropActorSheetData(actor, sheet, dragData);
        // Return false to prevent default item creation if we handled it
        if (handled) {
            return false;
        }
    } catch (error) {
        handleError(error as Error);
    }
});

Hooks.on('preCreateItem', async (
    item: Item,
    data: UpdateData,
    options: DocumentModificationContext,
    userId: string
) => {
    try {
        const shouldPrevent = await EventHandlerManager.getInstance().handleBeforeItemCreation(item, data);
        if (shouldPrevent) {
            return false; // Prevent item creation
        }
    } catch (error) {
        handleError(error as Error);
    }
});