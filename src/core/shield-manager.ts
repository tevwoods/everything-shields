import { Shield, ShieldParent, RuneRemovalOptions } from '../types/shield';
import { ShieldError, RuneError, handleError } from './errors';
import { SettingsManager } from './settings';

import { ShieldEffectManager } from './shield-effect-manager';
import { UpdateGuard } from './update-guard';
import { calculateShieldUpdates } from './shield-calculator';

/**
 * Look up a rune by name in the appropriate compendium and create it in the actor's inventory.
 */
async function returnRuneToActorInventory(actor: any, runeName: string, isFundamental: boolean): Promise<void> {
    if (!actor) {
        console.warn('Everything Shields | Cannot return rune to inventory: no actor found');
        return;
    }

    try {
        const packName = isFundamental
            ? 'everything-shields.everything-shields-fundamental-runes'
            : 'everything-shields.everything-shields-property-runes';

        const pack = (game as any).packs.get(packName);
        if (!pack) {
            console.warn(`Everything Shields | Compendium ${packName} not found`);
            return;
        }

        const index = pack.index.find((entry: any) =>
            entry.name === runeName || entry.name.toLowerCase() === runeName.toLowerCase()
        );

        if (!index) {
            console.warn(`Everything Shields | Rune "${runeName}" not found in compendium ${packName}`);
            return;
        }

        const runeDoc = await pack.getDocument(index._id) as any;
        if (!runeDoc) return;

        const runeData = runeDoc.toObject ? runeDoc.toObject() : runeDoc;
        await actor.createEmbeddedDocuments('Item', [runeData]);
        console.log(`Everything Shields | Returned ${runeName} to ${actor.name}'s inventory`);
    } catch (error) {
        console.error('Everything Shields | Error returning rune to inventory:', error);
    }
}

export class ShieldManager {
    private static instance: ShieldManager;
    private settings: SettingsManager;
    private effectManager: ShieldEffectManager;

    private constructor() {
        this.settings = SettingsManager.getInstance();
        this.effectManager = ShieldEffectManager.getInstance();
    }

    public static getInstance(): ShieldManager {
        if (!ShieldManager.instance) {
            ShieldManager.instance = new ShieldManager();
        }
        return ShieldManager.instance;
    }

    private async getShieldAndParent(parentId: string, shieldId: string): Promise<[Shield, ShieldParent]> {
        // Try to get actor by ID first (parentId is just an ID, not a UUID)
        let parent = (game as any).actors?.get(parentId) as ShieldParent;
        
        // If not found by ID, try as UUID
        if (!parent) {
            parent = await fromUuid(parentId) as ShieldParent;
        }
        
        if (!parent) {
            throw new ShieldError(`Could not find shield parent with ID ${parentId}`);
        }

        const shield = parent.items.find(item => item.id === shieldId);
        if (!shield) {
            throw new ShieldError(`Could not find shield with ID ${shieldId}`);
        }

        return [shield, parent];
    }

    public async removePropertyRune(options: RuneRemovalOptions): Promise<void> {
        try {
            const { shieldParentId, shieldId, runeName } = options;
            if (!runeName) {
                throw new RuneError('Property rune name is required');
            }

            const [shield, parent] = await this.getShieldAndParent(shieldParentId, shieldId);
            
            // Check all three property rune slots
            const propertyRune1 = (shield.system as any).propertyRune1?.value;
            const propertyRune2 = (shield.system as any).propertyRune2?.value;
            const propertyRune3 = (shield.system as any).propertyRune3?.value;
            
            let runeSlot: string | null = null;
            if (propertyRune1 === runeName) runeSlot = 'system.propertyRune1.value';
            else if (propertyRune2 === runeName) runeSlot = 'system.propertyRune2.value';
            else if (propertyRune3 === runeName) runeSlot = 'system.propertyRune3.value';
            
            if (!runeSlot) {
                throw new RuneError(`Shield does not have property rune: ${runeName}`);
            }

            // Clear the rune slot
            await UpdateGuard.runExclusive(shield.id, async () =>
                shield.update({ [runeSlot!]: null })
            );

            // Remove any Rule Elements that were copied from this property rune
            const existingRules: any[] = (shield as any).system.rules || [];
            const filteredRules = existingRules.filter((rule: any) => rule._esRuneSource !== runeName);
            if (filteredRules.length !== existingRules.length) {
                await shield.update({ 'system.rules': filteredRules });
                console.log(`Everything Shields | Removed ${existingRules.length - filteredRules.length} rule element(s) for ${runeName}`);
            }

            // Return the removed rune to the actor's inventory
            const actor = (shield as any).parent || (shield as any).actor;
            await returnRuneToActorInventory(actor, runeName, false);

            // Reload shield after update to get fresh data
            const reloadedShield = (parent as any).items.get(shieldId);
            if (reloadedShield) {
                // Update shield name and description
                await this.updateShieldName(reloadedShield);
                const finalShield = (parent as any).items.get(shieldId);
                if (finalShield) {
                    await this.updateShieldDescription(finalShield);
                }
            }

            ui.notifications.info(`Removed ${runeName} from shield and returned it to inventory.`);
        } catch (error) {
            handleError(error as Error);
        }
    }

    public async removePotencyRune(options: RuneRemovalOptions): Promise<void> {
        try {
            const { shieldParentId, shieldId } = options;
            const [shield, parent] = await this.getShieldAndParent(shieldParentId, shieldId);
            
            if (!shield.system.potencyRune?.value) {
                throw new RuneError('Shield does not have a potency rune');
            }

            const actor = (shield as any).parent || (shield as any).actor;
            const potencyLevel = shield.system.potencyRune.value;

            // Cascade: remove all property runes first (property runes require a potency rune)
            const propertyRune1 = (shield.system as any).propertyRune1?.value;
            const propertyRune2 = (shield.system as any).propertyRune2?.value;
            const propertyRune3 = (shield.system as any).propertyRune3?.value;
            const removedPropertyRunes: string[] = [];

            if (propertyRune1) removedPropertyRunes.push(propertyRune1);
            if (propertyRune2) removedPropertyRunes.push(propertyRune2);
            if (propertyRune3) removedPropertyRunes.push(propertyRune3);

            // Restore base HP from flags
            const baseHP = (shield as any).flags?.['everything-shields']?.baseHP || shield.system.hp.max;
            const materialModifier = (shield as any).flags?.['everything-shields']?.materialModifier || 0;
            const restoredHP = baseHP + materialModifier;
            const restoredBrokenThreshold = Math.floor(restoredHP / 2);

            // Clear the potency rune, all property runes, and restore HP
            await UpdateGuard.runExclusive(shield.id, async () =>
                shield.update({
                    'system.potencyRune.value': null,
                    'system.propertyRune1.value': null,
                    'system.propertyRune2.value': null,
                    'system.propertyRune3.value': null,
                    'system.hp.max': restoredHP,
                    'system.hp.brokenThreshold': restoredBrokenThreshold,
                    'flags.everything-shields.potencyMultiplier': null,
                    'flags.everything-shields.isDivineAlly': null
                })
            );

            // Remove Rule Elements for all property runes being cascaded
            const existingRules: any[] = (shield as any).system.rules || [];
            const filteredRules = existingRules.filter((rule: any) =>
                !removedPropertyRunes.includes(rule._esRuneSource)
            );
            if (filteredRules.length !== existingRules.length) {
                await shield.update({ 'system.rules': filteredRules });
                console.log(`Everything Shields | Cascade removed ${existingRules.length - filteredRules.length} rule element(s)`);
            }

            // Return potency rune to inventory
            const potencyName = `+${potencyLevel} Shield Potency Rune`;
            await returnRuneToActorInventory(actor, potencyName, true);

            // Return each removed property rune to inventory
            for (const propRune of removedPropertyRunes) {
                await returnRuneToActorInventory(actor, propRune, false);
            }

            // Reload shield after update to get fresh data
            const reloadedShield = (parent as any).items.get(shieldId);
            if (reloadedShield) {
                await this.updateShieldName(reloadedShield);
                const finalShield = (parent as any).items.get(shieldId);
                if (finalShield) {
                    await this.updateShieldDescription(finalShield);
                }
            }

            const removedCount = removedPropertyRunes.length;
            const msg = removedCount > 0
                ? `Removed potency rune and ${removedCount} property rune(s) from shield. All runes returned to inventory.`
                : 'Removed potency rune from shield and returned it to inventory.';
            ui.notifications.info(msg);
        } catch (error) {
            handleError(error as Error);
        }
    }

    public async removeHardenedRune(options: RuneRemovalOptions): Promise<void> {
        try {
            const { shieldParentId, shieldId } = options;
            const [shield, parent] = await this.getShieldAndParent(shieldParentId, shieldId);
            
            if (!shield.system.resiliencyRune?.value) {
                throw new RuneError('Shield does not have a hardened rune');
            }

            const actor = (shield as any).parent || (shield as any).actor;
            const hardenedLevel = shield.system.resiliencyRune.value;

            // Build rune name for inventory return
            const hardenedName = hardenedLevel === 'greater' ? 'Hardened Rune, Greater'
                               : hardenedLevel === 'major' ? 'Hardened Rune, Major'
                               : 'Hardened Rune';

            // Restore base hardness from flags
            const baseHardness = (shield as any).flags?.['everything-shields']?.baseHardness || shield.system.hardness;

            // Clear the rune and restore hardness
            await UpdateGuard.runExclusive(shield.id, async () =>
                shield.update({
                    'system.resiliencyRune.value': null,
                    'system.hardness': baseHardness,
                    'flags.everything-shields.hardenedBonus': null
                })
            );

            // Return hardened rune to inventory
            await returnRuneToActorInventory(actor, hardenedName, true);

            // Reload shield after update to get fresh data
            const reloadedShield = (parent as any).items.get(shieldId);
            if (reloadedShield) {
                await this.updateShieldName(reloadedShield);
                const finalShield = (parent as any).items.get(shieldId);
                if (finalShield) {
                    await this.updateShieldDescription(finalShield);
                }
            }

            ui.notifications.info(`Removed ${hardenedName} from shield and returned it to inventory.`);
        } catch (error) {
            handleError(error as Error);
        }
    }

    public async applyDamage(shield: Shield, damage: number): Promise<void> {
        try {
            await this.effectManager.applyDamage(shield, damage);
        } catch (error) {
            handleError(error as Error);
        }
    }

    public async repair(shield: Shield, amount: number): Promise<void> {
        try {
            await this.effectManager.repair(shield, amount);
        } catch (error) {
            handleError(error as Error);
        }
    }

    public async addRune(shield: Shield, runeType: string, value: number): Promise<void> {
        try {
            if (this.settings.getSetting<boolean>('use-reinforcing-rune-instead-of-potency-and-hardened')) {
                if (runeType === 'potency' || runeType === 'hardened') {
                    throw new RuneError('Potency and Hardened runes are disabled when using Reinforcing runes');
                }
            }

            await this.effectManager.applyRuneEffect(shield, runeType, value);

            // Update the rune system data
            const update = {
                [`system.runes.${runeType}`]: value
            };

            await UpdateGuard.runExclusive(shield.id, async () => shield.update(update));

        } catch (error) {
            handleError(error as Error);
        }
    }

    public async updateShieldName(shield: Shield): Promise<void> {
        if (!this.settings.getSetting<boolean>('should-generate-shield-names')) {
            return;
        }

        // Use calculator to generate a consistent name
        const calc = calculateShieldUpdates(shield);
        if (calc.name) {
            await UpdateGuard.runExclusive(shield.id, async () => shield.update({ name: calc.name }));
        }
    }

    /**
     * Get property rune description from compendium
     */
    private async getPropertyRuneDescription(runeName: string): Promise<string | null> {
        try {
            const pack = (game as any).packs.get('everything-shields.everything-shields-property-runes');
            if (!pack) {
                console.warn('Everything Shields | Property runes compendium not found');
                return null;
            }

            const index = pack.index.find((entry: any) => 
                entry.name.toLowerCase() === runeName.toLowerCase() ||
                entry.name.toLowerCase() === `${runeName.toLowerCase()} rune` ||
                entry.name.toLowerCase() === `${runeName.toLowerCase()} shield rune`
            );

            if (!index) {
                console.warn(`Everything Shields | Property rune "${runeName}" not found in compendium`);
                return null;
            }

            const runeItem = await pack.getDocument(index._id) as any;
            return runeItem?.system?.description?.value || null;
        } catch (error) {
            console.error('Everything Shields | Error fetching property rune description:', error);
            return null;
        }
    }

    /**
     * Remove all property rune sections from description
     */
    private removePropertyRuneSections(description: string): string {
        // Remove all property rune divs (they have class starting with "property-rune-")
        // Use regex to match divs with property-rune classes
        return description.replace(/<div\s+class="property-rune-[^"]*">[\s\S]*?<\/div>/gi, '');
    }

    /**
     * Update table values in shield description (HP, Hardness, BT)
     */
    private updateShieldTableValues(description: string, shield: any): string {
        const hp = shield.system?.hp?.max || 0;
        const hardness = shield.system?.hardness || 0;
        const bt = Math.floor(hp / 2);

        // Update hardness value
        description = this.replaceTableValue(description, 'everything-shields_hardness', hardness);
        
        // Update hit points value  
        description = this.replaceTableValue(description, 'everything-shields_hit-points', hp);
        
        // Update broken threshold value
        description = this.replaceTableValue(description, 'everything-shields_broken-threshold', bt);

        return description;
    }

    /**
     * Replace a value in the shield table
     */
    private replaceTableValue(description: string, className: string, newValue: number): string {
        const needle = `<td class="${className}">`;
        const indexOfNeedle = description.indexOf(needle);

        if (indexOfNeedle !== -1) {
            const endIndex = description.indexOf('</td>', indexOfNeedle);
            if (endIndex !== -1) {
                return description.substring(0, indexOfNeedle + needle.length) + 
                       newValue + 
                       description.substring(endIndex);
            }
        }

        return description;
    }

    public async updateShieldDescription(shield: Shield): Promise<void> {
        if (!this.settings.getSetting<boolean>('should-generate-shield-descriptions')) {
            return;
        }

        // Build description with remove buttons for fundamental runes
        let description = shield.system.description?.value ?? '';
        
        const shieldAny = shield as any;
        const potencyRune = shieldAny.system.potencyRune?.value;
        const hardenedRune = shieldAny.system.resiliencyRune?.value;
        const propertyRune1 = shieldAny.system.propertyRune1?.value;
        const propertyRune2 = shieldAny.system.propertyRune2?.value;
        const propertyRune3 = shieldAny.system.propertyRune3?.value;
        
        // Get parent actor ID - the shield's parent property contains the actor
        const parentActorId = shieldAny.parent?.id || shieldAny.actor?.id;
        
        console.log('Everything Shields | Building description buttons:', {
            shieldId: shield.id,
            shieldName: shieldAny.name,
            parentActorId,
            parentExists: !!shieldAny.parent,
            actorExists: !!shieldAny.actor,
            potencyRune,
            hardenedRune,
            propertyRune1,
            propertyRune2,
            propertyRune3
        });
        
        // Remove old property rune sections
        description = this.removePropertyRuneSections(description);
        
        // Update table values (HP, Hardness, BT)
        description = this.updateShieldTableValues(description, shieldAny);
        
        // Add property rune descriptions
        const propertyRunes = [propertyRune1, propertyRune2, propertyRune3].filter(r => r);
        for (const runeName of propertyRunes) {
            const runeDescription = await this.getPropertyRuneDescription(runeName);
            if (runeDescription) {
                const runeId = `property-rune-${runeName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
                description += `
<div class="${runeId}">
<br>
<h3>${runeName}</h3>
${runeDescription}
<button class="everything-shields-button everything-shields-remove-property-rune" data-shield-id="${shield.id}" data-shield-parent-id="${parentActorId}" data-shield-property-rune-name="${runeName}" style="transform: scale(0.8);">
    Remove ${runeName}
</button>
</div>`;
            }
        }
        
        // Always remove existing fundamental rune buttons before rebuilding
        const buttonStart = description.indexOf('<div class="dialog-buttons everything-shields-buttons">');
        if (buttonStart !== -1) {
            const buttonEnd = description.indexOf('</div>', buttonStart);
            if (buttonEnd !== -1) {
                description = description.substring(0, buttonStart) + description.substring(buttonEnd + 6);
            }
        }

        // Add buttons for removing fundamental runes (only if runes are present)
        if (potencyRune || hardenedRune) {
            description += '<div class="dialog-buttons everything-shields-buttons">';
            
            if (hardenedRune) {
                const hardenedName = hardenedRune === 'greater' ? 'Hardened Rune, Greater' : 
                                   hardenedRune === 'major' ? 'Hardened Rune, Major' : 
                                   'Hardened Rune';
                description += `<button class="dialog-button everything-shields-button everything-shields-remove-hardened-rune" data-shield-id="${shield.id}" data-shield-parent-id="${parentActorId}">Remove ${hardenedName}</button>`;
            }
            
            if (potencyRune) {
                const potencyName = `+${potencyRune} Shield Potency Rune`;
                description += `<button class="dialog-button everything-shields-button everything-shields-remove-potency-rune" data-shield-id="${shield.id}" data-shield-parent-id="${parentActorId}">Remove ${potencyName}</button>`;
            }
            
            description += '</div>';
        }

        const updates: Record<string, any> = {
            'system.description.value': description
        };

        if (Object.keys(updates).length) {
            await UpdateGuard.runExclusive(shield.id, async () => shield.update(updates));
        }
    }

    /**
     * Recalculate and apply all derived shield stats (price, HP, hardness, description, name)
     */
    public async recalcShield(shield: Shield): Promise<void> {
        try {
            const calc = calculateShieldUpdates(shield);
            const updates: Record<string, any> = {};
            if (calc.name) updates['name'] = calc.name;
            if (calc.description) updates['system.description.value'] = calc.description;
            if (typeof calc.price === 'number') updates['system.price.value'] = calc.price;
            if (typeof calc.hpMax === 'number') updates['system.hp.max'] = calc.hpMax;
            if (typeof calc.hardness === 'number') updates['system.hardness'] = calc.hardness;

            if (Object.keys(updates).length) {
                await UpdateGuard.runExclusive(shield.id, async () => shield.update(updates));
            }
        } catch (error) {
            handleError(error as Error);
        }
    }
}