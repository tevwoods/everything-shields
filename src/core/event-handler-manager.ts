import { Shield } from '../types/shield';
import { Actor, ActorSheet, DragData, Item, UpdateData } from '../types/foundry-types';
import { ShieldManager } from './shield-manager';
import { handleError } from './errors';
import { SettingsManager } from './settings';
import {
    isSturdyOrWovenwoodShield,
    isLesserVersionOfRune,
    isGreaterOrEqualVersionOfRune,
    getMaterialPrice,
    getMaterialLevel,
    getMaterialBulkModifier,
} from '../data/shield-constants';

export class EventHandlerManager {
    private static instance: EventHandlerManager;
    private shieldManager: ShieldManager;
    private settings: SettingsManager;
    private boundHandleClick: (event: MouseEvent) => void;
    private pendingRuneDrops: Set<string> = new Set(); // Track runes we're handling via dialog
    private isShowingRuneDialog: boolean = false; // Flag to prevent item creation during dialog

    private constructor() {
        this.shieldManager = ShieldManager.getInstance();
        this.settings = SettingsManager.getInstance();
        this.boundHandleClick = this.handleClick.bind(this);
    }

    public static getInstance(): EventHandlerManager {
        if (!EventHandlerManager.instance) {
            EventHandlerManager.instance = new EventHandlerManager();
        }
        return EventHandlerManager.instance;
    }

    public initialize(): void {
        this.registerEventListeners();
    }

    public cleanup(): void {
        this.removeEventListeners();
    }

    private registerEventListeners(): void {
        document.body.addEventListener('click', this.boundHandleClick);
    }

    private removeEventListeners(): void {
        document.body.removeEventListener('click', this.boundHandleClick);
    }

    private async handleClick(event: MouseEvent): Promise<void> {
        const target = event.target as HTMLElement;
        if (!target.classList.contains('everything-shields-button')) {
            return;
        }

        try {
            const shieldParentId = target.dataset.shieldParentId;
            const shieldId = target.dataset.shieldId;

            if (!shieldParentId || !shieldId) {
                throw new Error('Missing required data attributes');
            }

            if (target.classList.contains('everything-shields-remove-property-rune')) {
                const runeName = target.dataset.shieldPropertyRuneName;
                if (!runeName) {
                    throw new Error('Missing property rune name');
                }
                
                // Show confirmation dialog
                const confirmed = await Dialog.confirm({
                    title: 'Remove Property Rune',
                    content: `<p>Are you sure you want to remove the <strong>${runeName}</strong> from this shield?</p>`,
                    defaultYes: false
                });
                
                if (confirmed) {
                    await this.shieldManager.removePropertyRune({ shieldParentId, shieldId, runeName });
                }
            }
            else if (target.classList.contains('everything-shields-remove-hardened-rune')) {
                // Show confirmation dialog
                const confirmed = await Dialog.confirm({
                    title: 'Remove Hardened Rune',
                    content: '<p>Are you sure you want to remove the <strong>Hardened Rune</strong> from this shield?</p><p><em>This will restore the shield\'s base hardness.</em></p>',
                    defaultYes: false
                });
                
                if (confirmed) {
                    await this.shieldManager.removeHardenedRune({ shieldParentId, shieldId });
                }
            }
            else if (target.classList.contains('everything-shields-remove-potency-rune')) {
                // Show confirmation dialog
                const confirmed = await Dialog.confirm({
                    title: 'Remove Potency Rune',
                    content: '<p>Are you sure you want to remove the <strong>Potency Rune</strong> from this shield?</p><p><em>This will restore the shield\'s base HP and remove all property runes.</em></p>',
                    defaultYes: false
                });
                
                if (confirmed) {
                    await this.shieldManager.removePotencyRune({ shieldParentId, shieldId });
                }
            }
        }
        catch (error)
        {
            handleError(error as Error);
        }
    }

    public async handleUpdateItem(item: Item, changes: UpdateData, options?: any): Promise<void> {
        if (this.settings.getSetting<boolean>('disable-all-automations')) {
            return;
        }

        // Don't run automated updates if the item doesn't have a parent actor yet
        // This indicates it's being created/migrated
        const itemAny = item as any;
        if (!itemAny.actor || !itemAny.id) {
            return;
        }

        try {
            // Only process shield items
            if (!this.isShieldItem(item)) {
                return;
            }

            const shield = item as unknown as Shield;

            // Handle material type changes - recalculate HP with proper material modifiers
            // Check for material changes in nested object structure
            const hasMaterialChange = changes['system.preciousMaterial'] ||
                                     changes['system.preciousMaterialGrade'] ||
                                     changes['system.material'] || 
                                     (changes.system && ((changes.system as any).preciousMaterial || (changes.system as any).preciousMaterialGrade || (changes.system as any).material));
            if (hasMaterialChange) {
                console.log('Material change detected:', changes);
                await this.handleMaterialChange(itemAny);
            }

            // Update names and descriptions if needed
            // Check for any rune-related changes: system.runes, potencyRune, resiliencyRune, or propertyRune1/2/3
            const hasRuneChange = changes['system.runes'] || 
                                 changes['system.potencyRune'] || 
                                 changes['system.resiliencyRune'] ||
                                 changes['system.propertyRune1'] ||
                                 changes['system.propertyRune2'] ||
                                 changes['system.propertyRune3'] ||
                                 (changes.system && ((changes.system as any).potencyRune || 
                                                    (changes.system as any).resiliencyRune ||
                                                    (changes.system as any).propertyRune1 ||
                                                    (changes.system as any).propertyRune2 ||
                                                    (changes.system as any).propertyRune3));
            
            if (changes.name || changes['system.runes'] || hasRuneChange) {
                // Update price and level when runes change
                if (hasRuneChange) {
                    await this.updatePriceAndLevel(shield as any);
                }
                
                await this.shieldManager.updateShieldName(shield);
                await this.shieldManager.updateShieldDescription(shield);
            }

            // Check for rune changes and apply effects
            if (changes['system.runes']) {
                const runes = changes['system.runes'];
                if (runes.potency) {
                    await this.shieldManager.addRune(shield, 'potency', runes.potency);
                }
                if (runes.hardened) {
                    await this.shieldManager.addRune(shield, 'hardened', runes.hardened);
                }
                if (runes.reinforcing) {
                    await this.shieldManager.addRune(shield, 'reinforcing', runes.reinforcing);
                }
            }
        }
        catch (error) {
            handleError(error as Error);
        }
    }

    private isEverythingShieldsRuneDrop(dragData: DragData): boolean {
        const droppedType = dragData.data?.type;
        const droppedSystem = dragData.data?.system;
        const droppedSourceId = dragData.data?.flags?.core?.sourceId || '';
        const droppedPack = dragData.data?.pack || '';
        const droppedUsage = droppedSystem?.usage?.value || '';
        
        return (
            dragData.type === 'Item' &&
            (droppedPack.startsWith('everything-shields') || droppedSourceId.includes('everything-shields')) &&
            (droppedSystem?.propertyRune || 
             droppedType === 'shield-rune' || 
             droppedUsage === 'applied-to-shield')
        );
    }

    private isCompendiumRuneDrop(dragData: DragData): boolean {
        const uuid = dragData.uuid;
        return (
            typeof uuid === 'string' &&
            uuid.startsWith('Compendium.everything-shields.') &&
            (uuid.includes('fundamental-runes') || uuid.includes('property-runes'))
        );
    }

    private isFundamentalRune(dragData: DragData): boolean {
        const uuid = dragData.uuid || '';
        const name = dragData.data?.name || '';
        const usage = dragData.data?.system?.usage?.value || '';
        
        // Check if it's a fundamental rune by various criteria
        return (
            uuid.includes('fundamental-runes') ||
            name.toLowerCase().includes('potency') ||
            name.toLowerCase().includes('hardened') ||
            (usage === 'applied-to-shield' && !name.toLowerCase().includes('property'))
        );
    }

    private getShieldCategory(shield: any): 'light' | 'medium' | 'heavy' {
        const bulk = shield.system?.bulk?.value;
        if (bulk === 'L' || bulk === 0 || !bulk) {
            return 'light';
        }
        else if (bulk === 1) {
            return 'medium';
        }
        else {
            return 'heavy';
        }
    }

    private calculatePotencyHPMultiplier(potencyLevel: string): number {
        switch (potencyLevel) {
            case '1': return 3;
            case '2': return 5;
            case '3': return 7;
            default: return 1;
        }
    }

    private calculateHardenedBonus(hardenedLevel: string, category: 'light' | 'medium' | 'heavy'): number {
        const bonuses: { [key: string]: { light: number, medium: number, heavy: number } } = {
            'hardened': { light: 2, medium: 3, heavy: 4 },
            'greater': { light: 4, medium: 7, heavy: 8 },
            'major': { light: 8, medium: 11, heavy: 13 }
        };
        return bonuses[hardenedLevel]?.[category] || 0;
    }

    private getMaterialHPModifier(materialType: string, materialGrade?: string): number {
        // Based on Everything Shields PDF Table 5-3
        // Returns flat HP adjustment (NOT affected by shield category)
        
        // Normalize grade: Foundry uses 'low', 'standard', 'high' but we need 'low-grade', 'standard-grade', 'high-grade'
        const normalizedGrade = materialGrade ? `${materialGrade}-grade` : undefined;
        const key = normalizedGrade ? `${materialType}-${normalizedGrade}` : materialType;
        
        const materialModifiers: { [key: string]: number } = {
            // Low-grade materials
            'cold-iron-low-grade': 0,
            'silver-low-grade': -8,
            // Standard-grade materials
            'cold-iron-standard-grade': 8,
            'silver-standard-grade': 0,
            'abysium-standard-grade': 4,
            'adamantine-standard-grade': 20,
            'darkwood-standard-grade': 0,
            'djezet-standard-grade': 0,
            'dragonhide-standard-grade': 4,
            'inubrix-standard-grade': -4,
            'mithral-standard-grade': 0,
            'noqual-standard-grade': 4,
            'siccatite-standard-grade': 4,
            // High-grade materials
            'cold-iron-high-grade': 20,
            'silver-high-grade': 12,
            'abysium-high-grade': 20,
            'adamantine-high-grade': 32,
            'darkwood-high-grade': 20,
            'djezet-high-grade': 12,
            'dragonhide-high-grade': 12,
            'inubrix-high-grade': 8,
            'mithral-high-grade': 12,
            'noqual-high-grade': 20,
            'siccatite-high-grade': 20,
            'orichalcum': 44,
            // Common materials (no grade)
            'wood': 0,
            'steel': 0,
            'stone': 0
        };
        
        return materialModifiers[key] ?? 0;
    }

    private getMaterialHardnessModifier(materialType: string, materialGrade?: string): number {
        // Based on Everything Shields PDF Table 5-3
        // Returns flat Hardness adjustment (NOT affected by shield category)
        
        // Normalize grade: Foundry uses 'low', 'standard', 'high' but we need 'low-grade', 'standard-grade', 'high-grade'
        const normalizedGrade = materialGrade ? `${materialGrade}-grade` : undefined;
        const key = normalizedGrade ? `${materialType}-${normalizedGrade}` : materialType;
        
        const hardnessModifiers: { [key: string]: number } = {
            // Low-grade materials
            'cold-iron-low-grade': 0,
            'silver-low-grade': -2,
            // Standard-grade materials
            'cold-iron-standard-grade': 2,
            'silver-standard-grade': 0,
            'abysium-standard-grade': 1,
            'adamantine-standard-grade': 5,
            'darkwood-standard-grade': 0,
            'djezet-standard-grade': 0,
            'dragonhide-standard-grade': -1,
            'inubrix-standard-grade': -1,
            'mithral-standard-grade': 0,
            'noqual-standard-grade': 1,
            'siccatite-standard-grade': 1,
            // High-grade materials
            'cold-iron-high-grade': 5,
            'silver-high-grade': 3,
            'abysium-high-grade': 5,
            'adamantine-high-grade': 13,
            'darkwood-high-grade': 3,
            'djezet-high-grade': 3,
            'dragonhide-high-grade': 3,
            'inubrix-high-grade': 2,
            'mithral-high-grade': 3,
            'noqual-high-grade': 5,
            'siccatite-high-grade': 5,
            'orichalcum': 11,
            // Common materials (no grade)
            'wood': 0,
            'steel': 0,
            'stone': 0
        };
        
        return hardnessModifiers[key] ?? 0;
    }

    private async handleMaterialChange(shieldItem: any): Promise<void> {
        // Get the base HP (wood HP with no material bonuses)
        const storedBaseHP = shieldItem.flags?.['everything-shields']?.baseHP;
            const materialType = shieldItem.system.preciousMaterial?.value || shieldItem.system.material?.type || shieldItem.system.material?.precious?.type;
            const materialGrade = shieldItem.system.preciousMaterialGrade?.value || shieldItem.system.material?.grade || shieldItem.system.material?.precious?.grade;
        const category = this.getShieldCategory(shieldItem);
        
        console.log('handleMaterialChange:', { materialType, materialGrade, storedBaseHP, currentHP: shieldItem.system.hp.max });
        
        // If we don't have a stored base HP, try to reverse-engineer it
        let baseHP = storedBaseHP;
        if (!baseHP) {
            const currentHP = shieldItem.system.hp.max;
            const potencyMultiplier = shieldItem.flags?.['everything-shields']?.potencyMultiplier || 1;
            const oldMaterialModifier = shieldItem.flags?.['everything-shields']?.materialModifier || 0;
            // Reverse: base = (current - material) / potency
            baseHP = Math.floor((currentHP - oldMaterialModifier) / potencyMultiplier);
        }
        if (!baseHP) {
            // Fallback: use current HP as base
            baseHP = shieldItem.system.hp.max;
        }

        // Calculate new HP: (base HP × potency multiplier) + material modifier
        // Material HP is added AFTER potency multiplier
            const materialModifier = this.getMaterialHPModifier(materialType, materialGrade);
        const potencyMultiplier = shieldItem.flags?.['everything-shields']?.potencyMultiplier || 1;
        
        // Check for Divine Ally (Shield Ally) → 1.5× HP multiplier
        const isDivineAlly = this.getIsDivineAlly(shieldItem);
        const divineAllyMultiplier = isDivineAlly ? 1.5 : 1;
        
        const newMaxHP = Math.floor((Math.floor(baseHP * potencyMultiplier) + materialModifier) * divineAllyMultiplier);
        const newBrokenThreshold = Math.floor(newMaxHP / 2);

        // Also update hardness with material modifier
        const baseHardness = shieldItem.flags?.['everything-shields']?.baseHardness || shieldItem.system.hardness;
            const materialHardnessModifier = this.getMaterialHardnessModifier(materialType, materialGrade);
        const hardenedBonus = shieldItem.flags?.['everything-shields']?.hardenedBonus || 0;
        const newHardness = baseHardness + materialHardnessModifier + hardenedBonus;

        const updateData: any = {
            'system.hp.max': newMaxHP,
            'system.hp.brokenThreshold': newBrokenThreshold,
            'system.hardness': newHardness,
            'flags.everything-shields.baseHP': baseHP,
            'flags.everything-shields.materialModifier': materialModifier,
            'flags.everything-shields.materialHardnessModifier': materialHardnessModifier,
            'flags.everything-shields.isDivineAlly': isDivineAlly
        };

        // Apply material bulk modifier (e.g. darkwood/mithral reduce bulk, siccatite increases)
        const bulkMod = getMaterialBulkModifier(materialType, materialGrade);
        if (bulkMod !== 0) {
            const baseBulk = shieldItem.flags?.['everything-shields']?.bulk;
            if (baseBulk !== undefined) {
                // Bulk values in PF2e: 'L' = light, number = normal bulk
                let newBulk: any = baseBulk;
                if (typeof baseBulk === 'number') {
                    newBulk = Math.max(0, baseBulk + bulkMod);
                } else if (baseBulk === 'L' || baseBulk === 1) {
                    const numericBulk = baseBulk === 'L' ? 0 : baseBulk;
                    const adjusted = numericBulk + bulkMod;
                    newBulk = adjusted <= 0 ? 'L' : adjusted;
                }
                updateData['system.bulk.value'] = newBulk;
                updateData['flags.everything-shields.materialBulkModifier'] = bulkMod;
            }
        }

        // Ensure current HP doesn't exceed new max
        if (shieldItem.system.hp.value > newMaxHP) {
            updateData['system.hp.value'] = newMaxHP;
        }

        await shieldItem.update(updateData, { everythingShieldsRecalculating: true });
        
        // Check if shield should be marked as specific magic (has material + runes)
        await this.markAsSpecificMagicShield(shieldItem);
        
        console.log(`Material changed: HP = (${baseHP} × ${potencyMultiplier}) + ${materialModifier} = ${newMaxHP} HP, Hardness = ${baseHardness} + ${materialHardnessModifier} + ${hardenedBonus} = ${newHardness}`);
    }

    private async applyPotencyRuneEffect(shieldItem: any, potencyLevel: string): Promise<void> {
        const multiplier = this.calculatePotencyHPMultiplier(potencyLevel);
        const category = this.getShieldCategory(shieldItem);
        
        // Get base HP (wood HP with no modifiers) - if not stored, use current HP as base
        let baseHP = shieldItem.flags?.['everything-shields']?.baseHP;
        if (!baseHP) {
            // If no base HP stored, try to reverse-engineer it
            const currentHP = shieldItem.system.hp.max;
            const oldMaterialModifier = shieldItem.flags?.['everything-shields']?.materialModifier || 0;
            baseHP = currentHP - oldMaterialModifier;
        }
        if (!baseHP) {
            baseHP = shieldItem.system.hp.max;
        }
        
        // Get material modifier (flat addition, not affected by potency)
        const materialType = shieldItem.system.preciousMaterial?.value || shieldItem.system.material?.type || shieldItem.system.material?.precious?.type;
            const materialGrade = shieldItem.system.preciousMaterialGrade?.value || shieldItem.system.material?.grade || shieldItem.system.material?.precious?.grade;
            const materialModifier = this.getMaterialHPModifier(materialType, materialGrade);
        
        // Check for Divine Ally (Shield Ally) → 1.5× HP multiplier
        const isDivineAlly = this.getIsDivineAlly(shieldItem);
        const divineAllyMultiplier = isDivineAlly ? 1.5 : 1;
        
        // Calculate new HP: ((base HP × potency multiplier) + material modifier) × divine ally multiplier
        const newMaxHP = Math.floor((Math.floor(baseHP * multiplier) + materialModifier) * divineAllyMultiplier);
        const newBrokenThreshold = Math.floor(newMaxHP / 2);
        
        // Update shield HP values
        const updateData: any = {
            'system.hp.max': newMaxHP,
            'system.hp.brokenThreshold': newBrokenThreshold,
            'flags.everything-shields.baseHP': baseHP,
            'flags.everything-shields.potencyMultiplier': multiplier,
            'flags.everything-shields.materialModifier': materialModifier,
            'flags.everything-shields.isDivineAlly': isDivineAlly
        };
        
        // Ensure current HP doesn't exceed new max
        if (shieldItem.system.hp.value > newMaxHP) {
            updateData['system.hp.value'] = newMaxHP;
        }
        
        await shieldItem.update(updateData);
        
        console.log(`Applied +${potencyLevel} potency rune: ((${baseHP} × ${multiplier}) + ${materialModifier}) × ${divineAllyMultiplier} = ${newMaxHP} HP`);
    }

    private async applyHardenedRuneEffect(shieldItem: any, hardenedLevel: string): Promise<void> {
        const category = this.getShieldCategory(shieldItem);
        const hardnessBonus = this.calculateHardenedBonus(hardenedLevel, category);

        // Store base hardness if not already stored
        const baseHardness = shieldItem.flags?.['everything-shields']?.baseHardness ?? shieldItem.system.hardness;
        
        // Calculate new hardness
        const newHardness = baseHardness + hardnessBonus;

        // Update shield hardness
        await shieldItem.update({
            'system.hardness': newHardness,
            'flags.everything-shields.baseHardness': baseHardness,
            'flags.everything-shields.hardenedBonus': hardnessBonus
        });
        
        console.log(`Applied ${hardenedLevel} hardened rune: ${baseHardness} hardness -> ${newHardness} hardness (+${hardnessBonus})`);
    }

    /**
     * Copy a property rune's Rule Elements (system.rules) onto the shield.
     * This is required for runes like Energy-Resistant that use a ChoiceSet
     * rule element to prompt the user for an element selection.
     *
     * Each rule gets a unique slug so multiple property runes' rules don't collide.
     * ChoiceSet flag references are also prefixed to keep selections separate.
     */
    private async addRulesToShield(shieldItem: any, runeItem: any, runeName: string): Promise<void> {
        const runeRules: any[] = runeItem?.system?.rules;
        if (!runeRules || runeRules.length === 0) {
            return;
        }

        // Deep clone so we don't mutate the source item
        const clonedRules: any[] = JSON.parse(JSON.stringify(runeRules));

        // Generate a unique ID prefix for this rune's rules on this shield
        const runeTag = runeName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const uniqueId = (typeof randomID === 'function') ? randomID() : Math.random().toString(36).substring(2, 10);
        let choiceSetId: string | undefined;

        for (const rule of clonedRules) {
            const ruleId = `${runeTag}-${uniqueId}`;

            // Mark each rule with its origin rune name so we can remove them later
            rule._esRuneSource = runeName;

            if (rule.key === 'ChoiceSet') {
                rule.flag = `${ruleId}-${rule.flag || 'choice'}`;
                choiceSetId = ruleId;
            }

            // Rewrite any ChoiceSet flag references in string values
            if (choiceSetId) {
                for (const key of Object.keys(rule)) {
                    if (typeof rule[key] === 'string') {
                        rule[key] = rule[key].replace(
                            /item\|flags\.pf2e\.rulesSelections\./g,
                            `item|flags.pf2e.rulesSelections.${choiceSetId}-`
                        );
                    }
                }
            }

            rule.slug = `${rule.key}-${ruleId}`;
        }

        // Merge into the shield's existing rules
        const existingRules: any[] = [...(shieldItem.system.rules || [])];
        existingRules.push(...clonedRules);

        // Also copy rulesSelections flags if present
        const runeSelections = runeItem?.flags?.pf2e?.rulesSelections;
        const shieldSelections = shieldItem.flags?.pf2e?.rulesSelections || {};

        const updateData: any = {
            'system.rules': existingRules,
        };

        if (runeSelections) {
            const merged = { ...shieldSelections, ...runeSelections };
            updateData['flags.pf2e.rulesSelections'] = merged;
        }

        await shieldItem.update(updateData);
        console.log(`Everything Shields | Added ${clonedRules.length} rule element(s) from ${runeName} to ${shieldItem.name}`);
    }

    /**
     * Remove a property rune's Rule Elements from the shield.
     * Matches rules by the _esRuneSource tag we set during addRulesToShield().
     */
    private async removeRulesFromShield(shieldItem: any, runeName: string): Promise<void> {
        const existingRules: any[] = shieldItem.system.rules || [];
        if (existingRules.length === 0) {
            return;
        }

        const filteredRules = existingRules.filter((rule: any) => rule._esRuneSource !== runeName);

        if (filteredRules.length !== existingRules.length) {
            await shieldItem.update({ 'system.rules': filteredRules });
            console.log(`Everything Shields | Removed ${existingRules.length - filteredRules.length} rule element(s) for ${runeName} from ${shieldItem.name}`);
        }
    }

    /**
     * Get the full rune item data, either from the provided runeData object,
     * from the actor's inventory, or from the compendium.
     */
    private async getRuneItemData(actor: any, runeName: string, sourceRuneItemId?: string, runeData?: any): Promise<any> {
        // If we already have the full rune data (compendium drop), use it
        if (runeData?.system?.rules) {
            return runeData;
        }

        // Try to get from actor's inventory (inventory drop)
        if (sourceRuneItemId) {
            const inventoryItem = actor.items.get(sourceRuneItemId);
            if (inventoryItem) {
                return inventoryItem.toObject ? inventoryItem.toObject() : inventoryItem;
            }
        }

        // Fall back: search compendium for the rune by name
        try {
            const pack = (game.packs as any).get('everything-shields.everything-shields-property-runes');
            if (pack) {
                const index = await pack.getIndex();
                const entry = index.find((e: any) => e.name === runeName);
                if (entry) {
                    const item = await pack.getDocument(entry._id);
                    return (item as any).toObject ? (item as any).toObject() : item;
                }
            }
        } catch (err) {
            console.warn(`Everything Shields | Could not find rune item data for "${runeName}" in compendium:`, err);
        }

        return null;
    }

    private async applyInvestedTrait(shieldItem: any): Promise<void> {
        // Check if invested trait already exists
        const traits = shieldItem.system.traits?.value || [];
        if (!traits.includes('invested')) {
            await shieldItem.update({
                'system.traits.value': [...traits, 'invested']
            });
        }
    }

    /**
     * Apply specific traits based on property rune type.
     * - All runed shields get the 'abjuration' trait.
     * - Feather Shield Rune adds 'hb_shield-finesse' (homebrew finesse for shields).
     * - Throwing Shield Rune adds 'thrown-X' trait based on shield category.
     */
    private async applyPropertyRuneTraits(shieldItem: any, runeName: string): Promise<void> {
        const traits: string[] = [...(shieldItem.system.traits?.value || [])];
        let changed = false;

        // All runed shields should have the abjuration trait
        if (!traits.includes('abjuration')) {
            traits.push('abjuration');
            changed = true;
        }

        // Feather Shield Rune → finesse trait
        if (runeName.toLowerCase().includes('feather')) {
            if (!traits.includes('hb_shield-finesse')) {
                traits.push('hb_shield-finesse');
                changed = true;
            }
        }

        // Throwing Shield Rune → thrown trait with range based on category
        if (runeName.toLowerCase().includes('throwing')) {
            const category = this.getShieldCategory(shieldItem);
            const rangeMap: Record<string, number> = { light: 40, medium: 30, heavy: 20 };
            const range = rangeMap[category] || 20;
            const thrownTrait = `thrown-${range}`;
            // Remove any existing thrown trait
            const existingThrown = traits.findIndex(t => t.startsWith('thrown-'));
            if (existingThrown >= 0) {
                traits[existingThrown] = thrownTrait;
            } else {
                traits.push(thrownTrait);
            }
            changed = true;
        }

        if (changed) {
            await shieldItem.update({ 'system.traits.value': traits });
        }
    }

    private async markAsSpecificMagicShield(shieldItem: any): Promise<void> {
        // Mark as specific magic shield if ANY magical modification is applied:
        // - Has runes (potency, hardened, or property runes)
        // - Has precious material (with or without runes)
        const hasPreciousMaterial = !!(shieldItem.system.preciousMaterial?.value || shieldItem.system.material?.type);
        const hasRunes = !!(shieldItem.system.potencyRune?.value || 
                          shieldItem.system.resiliencyRune?.value ||
                          shieldItem.system.propertyRune1?.value ||
                          shieldItem.system.propertyRune2?.value ||
                          shieldItem.system.propertyRune3?.value);
        
        // Mark as specific if it has runes OR precious material (prevents PF2e price recalculation)
        const shouldBeSpecific = hasRunes || hasPreciousMaterial;
        const updateData: any = {};
        
        // Check or uncheck the "Specific Magic Shield" checkbox based on conditions
        if (shouldBeSpecific && !shieldItem.system.specific?.value) {
            updateData['system.specific.value'] = true;
            
            // Add magical trait if not present
            const traits = shieldItem.system.traits?.value || [];
            if (!traits.includes('magical')) {
                updateData['system.traits.value'] = [...traits, 'magical'];
            }
            
            // Set baseItem to the shield's slug or id if not already set
            if (!shieldItem.system.baseItem) {
                const baseItemSlug = shieldItem.system.slug || shieldItem.slug || shieldItem.id;
                updateData['system.baseItem'] = baseItemSlug;
            }
        }
        
        // Only update if we have changes
        if (Object.keys(updateData).length > 0) {
            await shieldItem.update(updateData);
        }
    }

    private async preserveInitialValues(shieldItem: any): Promise<void> {
        // Store base shield values before any runes are applied
        // This matches the preserveInitialValues() function from the original module
        if (shieldItem.flags?.['everything-shields']?.hitPoints) {
            // Already preserved
            return;
        }

        // Get price - could be in different formats depending on PF2e version
        let priceValue = 0;
        const rawPrice = shieldItem.system.price?.value;
        
        if (typeof rawPrice === 'number') {
            priceValue = rawPrice;
        } else if (typeof shieldItem.system.price === 'number') {
            priceValue = shieldItem.system.price;
        } else if (rawPrice && typeof rawPrice === 'object' && rawPrice.copperValue !== undefined) {
            // PF2e v6 uses copperValue, convert to gold
            priceValue = rawPrice.copperValue / 100;
        }

        console.log('Everything Shields | Preserving initial values:', {
            name: shieldItem.name,
            rawPrice: rawPrice,
            priceValue: priceValue,
            hp: shieldItem.system.hp.max,
            hardness: shieldItem.system.hardness
        });

        const updateData: any = {
            'flags.everything-shields.hitPoints': shieldItem.system.hp.max,
            'flags.everything-shields.hardness': shieldItem.system.hardness,
            'flags.everything-shields.name': shieldItem.name,
            'flags.everything-shields.bulk': shieldItem.system.bulk?.value || shieldItem.system.weight?.value,
            'flags.everything-shields.price': priceValue,
            'flags.everything-shields.level': shieldItem.system.level?.value || 0,
            'flags.everything-shields.description': shieldItem.system.description?.value || ''
        };

        await shieldItem.update(updateData);
    }

    private async storeBaseShieldName(shieldItem: any): Promise<void> {
        // Store the base shield name before any runes are applied
        // Only store if not already stored
        if (!shieldItem.flags?.['everything-shields']?.baseShieldName) {
            let baseName = shieldItem.name || 'Shield';
            
            // Remove text in parentheses first
            baseName = baseName.split('(')[0].trim();
            
            // If the name starts with +, extract everything after the + and first number
            // e.g., "+1 Hoplon" -> "Hoplon", "+2 Greater Hardened Seeing Hoplon" -> "Greater Hardened Seeing Hoplon"
            if (baseName.match(/^\+\d+\s+/)) {
                baseName = baseName.replace(/^\+\d+\s+/, '');
            }
            
            // Now remove any rune descriptors to get to the base shield name
            // Split by spaces and filter out rune-related words
            const parts = baseName.split(/\s+/);
            const runeWords = ['greater', 'major', 'hardened', 'reinforcing', 'seeing', 'attached', 'defiant', 'energy-resistant', 'spellguard', 'arrow-catching', 'spell-storing'];
            
            // Find where the base shield name starts (after all rune descriptors)
            let nameStartIndex = 0;
            for (let i = 0; i < parts.length; i++) {
                const word = parts[i].toLowerCase();
                if (!runeWords.includes(word)) {
                    nameStartIndex = i;
                    break;
                }
            }
            
            baseName = parts.slice(nameStartIndex).join(' ') || 'Shield';
            
            await shieldItem.update({
                'flags.everything-shields.baseShieldName': baseName
            });
        }
    }

    private getRunePrice(potencyLevel?: string, hardenedLevel?: string): number {
        let price = 0;

        // Shield Potency Rune prices (in gold pieces)
        if (potencyLevel) {
            switch (potencyLevel) {
                case '1': price += 35; break;
                case '2': price += 935; break;
                case '3': price += 8935; break;
            }
        }

        // Hardened Rune prices (in gold pieces)
        if (hardenedLevel) {
            switch (hardenedLevel) {
                case 'hardened':
                case '1':
                    price += 65;
                    break;
                case 'greater':
                case '2':
                    price += 1065;
                    break;
                case 'major':
                case '3':
                    price += 20065;
                    break;
            }
        }

        return price;
    }

    private getRuneLevel(potencyLevel?: string, hardenedLevel?: string): number {
        let level = 0;

        // Shield Potency Rune levels
        if (potencyLevel) {
            switch (potencyLevel) {
                case '1': level = Math.max(level, 3); break;
                case '2': level = Math.max(level, 9); break;
                case '3': level = Math.max(level, 15); break;
            }
        }

        // Hardened Rune levels
        if (hardenedLevel) {
            switch (hardenedLevel) {
                case 'hardened':
                case '1':
                    level = Math.max(level, 6);
                    break;
                case 'greater':
                case '2':
                    level = Math.max(level, 12);
                    break;
                case 'major':
                case '3':
                    level = Math.max(level, 18);
                    break;
            }
        }

        return level;
    }

    private async updatePriceAndLevel(shieldItem: any): Promise<void> {
        // Calculate total price and level based on base values + runes + materials
        const basePriceRaw = shieldItem.flags?.['everything-shields']?.price;
        const baseLevel = shieldItem.flags?.['everything-shields']?.level || 0;
        
        // Convert base price to number if stored as object
        let basePrice = 0;
        if (typeof basePriceRaw === 'number') {
            basePrice = basePriceRaw;
        } else if (basePriceRaw && typeof basePriceRaw === 'object' && basePriceRaw.copperValue !== undefined) {
            basePrice = basePriceRaw.copperValue / 100;
        }

        console.log('Everything Shields | Reading from flags:', {
            allFlags: shieldItem.flags?.['everything-shields'],
            basePriceRaw: basePriceRaw,
            basePriceConverted: basePrice,
            baseLevel
        });

        const potencyLevel = shieldItem.system.potencyRune?.value;
        const hardenedLevel = shieldItem.system.resiliencyRune?.value;

        // Calculate rune price and level
        const runePrice = this.getRunePrice(potencyLevel, hardenedLevel);
        const runeLevel = this.getRuneLevel(potencyLevel, hardenedLevel);

        // Calculate material price and level
        let materialPrice = 0;
        let materialLevel = 0;
        const materialType = shieldItem.system.preciousMaterial?.value || shieldItem.system.material?.type || shieldItem.system.material?.precious?.type;
        const materialGrade = shieldItem.system.preciousMaterialGrade?.value || shieldItem.system.material?.grade || shieldItem.system.material?.precious?.grade;
        if (materialType && materialGrade) {
            const category = this.getShieldCategory(shieldItem);
            materialPrice = getMaterialPrice(materialType, materialGrade, category);
            materialLevel = getMaterialLevel(materialType, materialGrade);
        }

        // Calculate property rune prices from compendium items (stored in flags)
        let propertyRunePrice = 0;
        let propertyRuneLevel = 0;
        const propRunes = [
            shieldItem.system.propertyRune1?.value,
            shieldItem.system.propertyRune2?.value,
            shieldItem.system.propertyRune3?.value
        ].filter(Boolean);

        // Try to get property rune prices from the compendium
        if (propRunes.length > 0) {
            try {
                const pack = (game as any).packs.get('everything-shields.everything-shields-property-runes');
                if (pack) {
                    for (const propRuneName of propRunes) {
                        const idx = pack.index.find((entry: any) =>
                            entry.name === propRuneName || entry.name.toLowerCase() === propRuneName.toLowerCase()
                        );
                        if (idx) {
                            const runeDoc = await pack.getDocument(idx._id) as any;
                            if (runeDoc) {
                                const runeRawPrice = runeDoc.system?.price?.value;
                                if (runeRawPrice) {
                                    // Price may be Coins object {gp, sp, cp, pp} or a number
                                    if (typeof runeRawPrice === 'number') {
                                        propertyRunePrice += runeRawPrice;
                                    } else if (runeRawPrice.gp !== undefined) {
                                        propertyRunePrice += (runeRawPrice.pp || 0) * 10 + (runeRawPrice.gp || 0) + (runeRawPrice.sp || 0) / 10 + (runeRawPrice.cp || 0) / 100;
                                    }
                                }
                                const runeItemLevel = runeDoc.system?.level?.value || 0;
                                propertyRuneLevel = Math.max(propertyRuneLevel, runeItemLevel);
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn('Everything Shields | Error fetching property rune prices:', err);
            }
        }

        const totalPrice = basePrice + runePrice + materialPrice + propertyRunePrice;
        const totalLevel = Math.max(baseLevel, runeLevel, materialLevel, propertyRuneLevel);

        console.log('Everything Shields | Updating price and level:', {
            basePrice,
            runePrice,
            materialPrice,
            propertyRunePrice,
            totalPrice,
            baseLevel,
            runeLevel,
            materialLevel,
            propertyRuneLevel,
            totalLevel
        });

        // PF2e uses Coins format: {pp, gp, sp, cp}
        // Convert total gold price to coins object
        const goldAmount = Math.floor(totalPrice);
        const silverAmount = Math.floor((totalPrice - goldAmount) * 10);
        
        // IMPORTANT: Mark as specific to prevent PF2e from overwriting price
        // AND update both system.price and flags to persist through PF2e's prep cycle
        const updateData: any = {
            'system.level.value': totalLevel,
            'system.price.value': {
                gp: goldAmount,
                sp: silverAmount,
                cp: 0,
                pp: 0
            },
            'system.price.per': 1,
            // Store in flags so it persists through PF2e's data preparation
            'flags.everything-shields.calculatedPrice': totalPrice
        };

        console.log('Everything Shields | Price update data:', updateData);

        await shieldItem.update(updateData);
    }

    /**
     * Display a dialog allowing the user to select a shield to apply the rune to.
     * If the user confirms application, the rune is added to the chosen shield and, if it originated
     * from the actor's inventory (sourceRuneItemId provided), that rune item is deleted so it does not remain.
     * If the user cancels the dialog, we create the rune item in inventory since we prevented its default creation.
     *
     * @param actor The actor receiving the rune application.
     * @param runeName The name of the rune being applied.
     * @param isFundamental Whether the rune is a fundamental rune (potency/hardened) vs property.
     * @param sourceRuneItemId Optional: the id of the rune item in the actor's inventory. Presence triggers deletion on success.
     * @param runeData The complete rune data from compendium, used to create the item if user cancels.
     */
    private async promptShieldSelectionAndApplyRune(actor: Actor, runeName: string, isFundamental: boolean = false, sourceRuneItemId?: string, runeData?: any): Promise<void> {
        // Find all shields - both core PF2e shields (type: armor, category: shield) and custom shields
        const shields = actor.items.filter((i: any) => {
            const item = i.value || i;
            const isShield = (item.type === 'armor' && item.system?.category === 'shield') || 
                           (item.type === 'shield');
            
            console.log('Everything Shields | Checking item:', {
                name: item.name,
                type: item.type,
                category: item.system?.category,
                isShield: isShield
            });
            
            return isShield;
        });

        console.log('Everything Shields | Found shields:', shields.length);

        if (shields.length === 0) {
            ui.notifications.warn('No shields found in inventory to apply the rune.');
            // If from compendium, create it in inventory since we prevented creation
            if (runeData && !sourceRuneItemId) {
                await actor.createEmbeddedDocuments('Item', [runeData]);
            }
            return;
        }

        const shieldOptions = shields.map((s: any) => {
            const item = s.value || s;
            return `<option value="${item.id}">${item.name}</option>`;
        }).join('');

        const content = `<form><div class='form-group'><label>Select a shield to apply the rune:</label><select id='shield-select'>${shieldOptions}</select></div></form>`;
        
        // @ts-ignore
        new (window as any).Dialog({
            title: 'Apply Shield Rune',
            content,
            buttons: {
                apply: {
                    label: 'Apply',
                    callback: async (html: any) => {
                        try {
                            const shieldId = html.find('#shield-select').val();
                            const shield = shields.find((s: any) => {
                                const item = s.value || s;
                                return item.id === shieldId;
                            });

                            if (!shield) {
                                return;
                            }

                            const shieldItem: any = (shield as any).value || shield;
                        
                        // Block Sturdy/Wovenwood shields from receiving runes
                        if (isSturdyOrWovenwoodShield(shieldItem)) {
                            new (window as any).Dialog({
                                title: 'Invalid Shield Choice',
                                content: 'Sturdy Shields and Wovenwood Shields cannot be combined with shield runes.',
                                buttons: { ok: { label: 'OK' } }
                            }).render(true);
                            return;
                        }
                        
                        // Handle fundamental runes (potency or hardened)
                        if (isFundamental) {
                            const isPotencyRune = runeName.toLowerCase().includes('potency') || runeName.includes('+');
                            const isHardenedRune = runeName.toLowerCase().includes('hardened');

                            if (isPotencyRune) {
                                // Preserve initial shield values before first rune application
                                await this.preserveInitialValues(shieldItem);
                                await this.storeBaseShieldName(shieldItem);
                                
                                // Reload the shield to get updated flags
                                const reloadedShield = (actor as any).items.get(shieldItem.id);
                                if (!reloadedShield) {
                                    ui.notifications.error('Failed to reload shield after preserving values');
                                    return;
                                }
                                const reloadedShieldItem = reloadedShield as any;
                                
                                // Extract the potency value (+1, +2, +3)
                                const potencyMatch = runeName.match(/\+(\d)/);
                                const potencyLevel = potencyMatch ? potencyMatch[1] : '1';
                                
                                // Check if existing potency rune is equal or superior
                                const existingPotency = reloadedShieldItem.system.potencyRune?.value;
                                if (existingPotency && parseInt(existingPotency) >= parseInt(potencyLevel)) {
                                    ui.notifications.warn(`This shield already has a +${existingPotency} Shield Potency Rune, which is equal or superior to +${potencyLevel}.`);
                                    return;
                                }
                                
                                const updateData: any = {};
                                updateData['system.potencyRune.value'] = potencyLevel;
                                await reloadedShieldItem.update(updateData);
                                
                                // Apply the HP multiplier effect via ActiveEffect
                                await this.applyPotencyRuneEffect(reloadedShieldItem, potencyLevel);
                                await this.applyInvestedTrait(reloadedShieldItem);
                                await this.markAsSpecificMagicShield(reloadedShieldItem);
                                
                                // Update price and level based on runes
                                await this.updatePriceAndLevel(reloadedShieldItem);
                                
                                // Update shield name and description
                                await this.shieldManager.updateShieldName(reloadedShieldItem);
                                await this.shieldManager.updateShieldDescription(reloadedShieldItem);
                                
                                ui.notifications.info(`Added ${runeName} to ${reloadedShieldItem.name}.`);
                                // Delete source rune item from inventory if it originated there
                                if (sourceRuneItemId) {
                                    await actor.deleteEmbeddedDocuments('Item', [sourceRuneItemId]);
                                }
                            }
                            else if (isHardenedRune) {
                                // Preserve initial shield values before first rune application
                                await this.preserveInitialValues(shieldItem);
                                await this.storeBaseShieldName(shieldItem);
                                
                                // Reload the shield to get updated flags
                                const reloadedShield = (actor as any).items.get(shieldItem.id);
                                if (!reloadedShield) {
                                    ui.notifications.error('Failed to reload shield after preserving values');
                                    return;
                                }
                                const reloadedShieldItem = reloadedShield as any;
                                
                                // Determine hardened level (hardened, greater, major)
                                let hardenedValue = 'hardened';
                                if (runeName.toLowerCase().includes('greater')) {
                                    hardenedValue = 'greater';
                                }
                                else if (runeName.toLowerCase().includes('major')) {
                                    hardenedValue = 'major';
                                }

                                // Check if existing hardened rune is equal or superior
                                const hardenedRank: Record<string, number> = { 'hardened': 1, 'greater': 2, 'major': 3 };
                                const existingHardened = reloadedShieldItem.system.resiliencyRune?.value;
                                if (existingHardened && (hardenedRank[existingHardened] || 0) >= (hardenedRank[hardenedValue] || 0)) {
                                    const existingName = existingHardened === 'greater' ? 'Greater Hardened' : existingHardened === 'major' ? 'Major Hardened' : 'Hardened';
                                    ui.notifications.warn(`This shield already has a ${existingName} Rune, which is equal or superior.`);
                                    return;
                                }

                                const updateData: any = {};
                                updateData['system.resiliencyRune.value'] = hardenedValue;
                                await reloadedShieldItem.update(updateData);
                                
                                // Apply the Hardness bonus effect via ActiveEffect
                                await this.applyHardenedRuneEffect(reloadedShieldItem, hardenedValue);
                                await this.applyInvestedTrait(reloadedShieldItem);
                                await this.markAsSpecificMagicShield(reloadedShieldItem);
                                
                                // Update price and level based on runes
                                await this.updatePriceAndLevel(reloadedShieldItem);
                                
                                // Update shield name and description
                                await this.shieldManager.updateShieldName(reloadedShieldItem);
                                await this.shieldManager.updateShieldDescription(reloadedShieldItem);
                                
                                ui.notifications.info(`Added ${runeName} to ${reloadedShieldItem.name}.`);
                                if (sourceRuneItemId) {
                                    await actor.deleteEmbeddedDocuments('Item', [sourceRuneItemId]);
                                }
                            }
                            else {
                                ui.notifications.error('Unknown fundamental rune type.');
                            }

                            return;
                        }

                        // Handle property runes
                        // Check if shield has a potency rune (required for property runes)
                        const potencyValue = shieldItem.system.potencyRune?.value;
                        if (!potencyValue) {
                            ui.notifications.warn('This shield must have a shield potency rune before property runes can be added.');
                            return;
                        }

                        // Determine max property rune slots based on potency (+1 = 1 slot, +2 = 2 slots, +3 = 3 slots)
                        const maxSlots = parseInt(potencyValue) || 1;
                        
                        const propertyRunes = [
                            shieldItem.system.propertyRune1?.value,
                            shieldItem.system.propertyRune2?.value,
                            shieldItem.system.propertyRune3?.value
                        ].slice(0, maxSlots);

                        // Check for exact duplicate and version conflicts
                        let isUpgradeVersion = false;
                        let lesserSlotIndex = -1;
                        for (let i = 0; i < propertyRunes.length; i++) {
                            const existingRune = propertyRunes[i];
                            if (!existingRune) continue;

                            if (existingRune === runeName) {
                                ui.notifications.warn(`${shieldItem.name} already has this property rune.`);
                                return;
                            }
                            // Check if existing rune is a superior version — block the application
                            if (isGreaterOrEqualVersionOfRune(existingRune, runeName)) {
                                ui.notifications.warn(`${shieldItem.name} already has a superior or equal version of this rune.`);
                                return;
                            }
                            // Check if existing rune is an inferior version — we'll upgrade it
                            if (isLesserVersionOfRune(existingRune, runeName)) {
                                isUpgradeVersion = true;
                                lesserSlotIndex = i;
                            }
                        }

                        // Get the full rune item data so we can copy its Rule Elements
                        const runeItemData = await this.getRuneItemData(actor, runeName, sourceRuneItemId, runeData);

                        // If not an upgrade, check for open slot
                        if (!isUpgradeVersion) {
                            const slot = propertyRunes.findIndex(r => !r);
                            if (slot === -1) {
                                ui.notifications.warn(`All ${maxSlots} property rune slot(s) are filled for this +${potencyValue} shield.`);
                                return;
                            }

                            const updateData: any = {};
                            updateData[`system.propertyRune${slot+1}.value`] = runeName;
                            await shieldItem.update(updateData);
                        } else {
                            // Upgrade: replace the lesser rune in its slot
                            const slotNum = lesserSlotIndex + 1;
                            const replacedRuneName = propertyRunes[lesserSlotIndex];

                            // Remove the old rune's Rule Elements before replacing
                            await this.removeRulesFromShield(shieldItem, replacedRuneName);

                            const updateData: any = {};
                            updateData[`system.propertyRune${slotNum}.value`] = runeName;
                            await shieldItem.update(updateData);
                            
                            // Return the replaced (lesser) rune to inventory
                            await this.returnRuneToInventory(shieldItem.parent || shieldItem.actor, replacedRuneName, false);
                            ui.notifications.info(`Upgraded ${replacedRuneName} to ${runeName}.`);
                        }
                        
                        // Reload shield item from actor to get fresh data
                        const reloadedShieldAfterRune = (actor as any).items.get(shieldItem.id) as any;
                        if (!reloadedShieldAfterRune) {
                            ui.notifications.error('Failed to reload shield after adding property rune');
                            return;
                        }

                        // Copy the rune's Rule Elements onto the shield
                        // (e.g. Energy-Resistant's ChoiceSet for element selection)
                        if (runeItemData) {
                            await this.addRulesToShield(reloadedShieldAfterRune, runeItemData, runeName);
                        }
                        
                        // Apply invested trait for property runes
                        await this.applyInvestedTrait(reloadedShieldAfterRune);
                        
                        // Apply property rune-specific traits
                        await this.applyPropertyRuneTraits(reloadedShieldAfterRune, runeName);
                        
                        await this.markAsSpecificMagicShield(reloadedShieldAfterRune);
                        
                        // Update shield name with new property rune
                        await this.shieldManager.updateShieldName(reloadedShieldAfterRune);
                        
                        // Reload again after name update to get fresh data for description
                        const reloadedShieldAfterName = (actor as any).items.get(shieldItem.id) as any;
                        if (reloadedShieldAfterName) {
                            await this.shieldManager.updateShieldDescription(reloadedShieldAfterName);
                        }
                        
                        ui.notifications.info(`Added ${runeName} to ${reloadedShieldAfterRune.name}.`);
                        if (sourceRuneItemId) {
                            await actor.deleteEmbeddedDocuments('Item', [sourceRuneItemId]);
                        }
                        } finally {
                            // Clear the dialog flag when dialog closes
                            this.isShowingRuneDialog = false;
                        }
                    }
                },
                
                cancel:
                {
                    label: 'Cancel',
                    callback: async () => {
                        try {
                            // If this rune came from compendium (not inventory), create it in inventory
                            // since we prevented its default creation
                            if (runeData && !sourceRuneItemId) {
                                await actor.createEmbeddedDocuments('Item', [runeData]);
                                ui.notifications.info(`${runeName} added to inventory.`);
                            }
                        } finally {
                            // Clear the dialog flag when dialog closes
                            this.isShowingRuneDialog = false;
                        }
                    }
                }
            },
            default: 'apply'
        }).render(true);
    }

    private handleCompendiumRuneDrop(actor: Actor, dragData: DragData): boolean {
        if (this.isCompendiumRuneDrop(dragData)) {
            const uuid = dragData.uuid as string;
            
            // Set flag IMMEDIATELY to block item creation
            this.isShowingRuneDialog = true;
            
            // Fetch and show dialog asynchronously (don't await)
            (async () => {
                try {
                    const runeItem = await (fromUuid(uuid) as any);
                    if (!runeItem) {
                        ui.notifications.error('Could not find rune item.');
                        this.isShowingRuneDialog = false;
                        return;
                    }

                    const runeName = runeItem.name || 'Unknown Rune';
                    const isFundamental = this.isFundamentalRune(dragData);
                    // Convert to plain object for item creation if needed
                    const runeData = runeItem.toObject ? runeItem.toObject() : runeItem;
                    
                    await this.promptShieldSelectionAndApplyRune(actor, runeName, isFundamental, undefined, runeData);
                } catch (error) {
                    handleError(error as Error);
                    this.isShowingRuneDialog = false;
                }
            })();
            
            return true;
        }
        else {
            return false;
        }
    }

    public handleDropActorSheetData(actor: Actor, sheet: ActorSheet, dragData: DragData): boolean {
        if (this.settings.getSetting<boolean>('disable-all-automations')) {
            return false;
        }

        try {
            // Handle compendium rune drop
            if (this.handleCompendiumRuneDrop(actor, dragData)) {
                return true;
            }

            // Handle item rune drop from inventory
            if (this.isEverythingShieldsRuneDrop(dragData)) {
                const droppedSystem = dragData.data?.system;
                const runeName = droppedSystem?.propertyRune || dragData.data?.name;
                const isFundamental = this.isFundamentalRune(dragData);
                const sourceRuneItemId = dragData.data?._id; // id of rune item in inventory being dropped
                
                // Set flag IMMEDIATELY to block item creation
                this.isShowingRuneDialog = true;
                
                // Show dialog asynchronously (don't await)
                (async () => {
                    try {
                        await this.promptShieldSelectionAndApplyRune(actor, runeName, isFundamental, sourceRuneItemId);
                    } catch (error) {
                        handleError(error as Error);
                        this.isShowingRuneDialog = false;
                    }
                })();
                
                return true;
            }

            // Only process shield drops
            const droppedType = dragData.data?.type;
            const droppedSystem = dragData.data?.system;
            if (!(droppedType === 'shield' || (droppedType === 'armor' && droppedSystem?.category === 'shield'))) {
                return false;
            }

            // Handle shield drop logic here
            // For example, checking if it's a rune being dropped on a shield
            return false;
        }

        catch (error) {
            handleError(error as Error);
            return false;
        }
    }

    public async handleBeforeItemCreation(item: Item, data: UpdateData): Promise<boolean> {
        if (this.settings.getSetting<boolean>('disable-all-automations')) {
            return false;
        }

        try {
            const itemAny = item as any;
            const itemData = data as any;
            const itemName = itemAny.name || itemData?.name || '';
            const itemType = itemAny.type || itemData?.type || '';
            
            console.log('preCreateItem check:', { 
                name: itemName, 
                type: itemType,
                isShowingDialog: this.isShowingRuneDialog
            });
            
            // If we're currently showing the rune dialog, block ALL item creation
            // This prevents the rune from being auto-created while user makes a choice
            if (this.isShowingRuneDialog) {
                // Check if it's a rune-type item
                if (itemType === 'equipment' && (itemName.toLowerCase().includes('rune') || itemName.includes('+'))) {
                    console.log('✓ Preventing rune creation - dialog is active');
                    return true;
                }
            }

            // Only process shield items for other validations
            if (!this.isShieldItem(item)) {
                return false;
            }

            // Handle pre-creation validation and modifications here
            return false;
        }
        catch (error) {
            handleError(error as Error);
            return false;
        }
    }

    /**
     * Return a rune to the actor's inventory by looking it up in the appropriate compendium.
     * @param actor The actor to receive the rune item
     * @param runeName The name of the rune to return
     * @param isFundamental Whether this is a fundamental rune (potency/hardened) vs property rune
     */
    private async returnRuneToInventory(actor: any, runeName: string, isFundamental: boolean): Promise<void> {
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

            // Search for the rune by name
            const index = pack.index.find((entry: any) =>
                entry.name === runeName ||
                entry.name.toLowerCase() === runeName.toLowerCase()
            );

            if (!index) {
                console.warn(`Everything Shields | Rune "${runeName}" not found in compendium ${packName}`);
                return;
            }

            const runeDoc = await pack.getDocument(index._id) as any;
            if (!runeDoc) {
                console.warn(`Everything Shields | Could not load rune document for "${runeName}"`);
                return;
            }

            const runeData = runeDoc.toObject ? runeDoc.toObject() : runeDoc;
            await actor.createEmbeddedDocuments('Item', [runeData]);
            console.log(`Everything Shields | Returned ${runeName} to ${actor.name}'s inventory`);
        } catch (error) {
            console.error('Everything Shields | Error returning rune to inventory:', error);
        }
    }

    /**
     * Determine whether the provided Item-like object represents a shield in PF2e.
     */
    private isShieldItem(itemLike: { type?: string; system?: any }): boolean {
        if (!itemLike) {
            return false;
        }

        if (itemLike.type === 'shield') {
            return true;
        }

        if (itemLike.type === 'armor' && itemLike.system?.category === 'shield') {
            return true;
        }
        else {
            return false;
        }
    }

    /**
     * Detect whether the shield's owning actor has the Champion "Divine Ally → Shield Ally" class feature.
     * If so, the shield's HP should be multiplied by 1.5×.
     */
    private getIsDivineAlly(shield: any): boolean {
        try {
            const actor = shield.parent || shield.actor;
            if (!actor) return false;

            // PF2e stores class features in feats → classfeature category
            const classFeats = actor.feats?.get?.('classfeature');
            if (!classFeats) return false;

            const divineAlly = classFeats.feats?.find?.((entry: any) => entry.feat?.name === 'Divine Ally');
            if (!divineAlly) return false;

            // Check if the Shield Ally grant is present
            if (divineAlly.grants?.find?.((granted: any) => granted.feat?.name === 'Shield Ally')) {
                return true;
            }
        } catch {
            // Fail silently — actor might not have feats data structure
        }
        return false;
    }

}