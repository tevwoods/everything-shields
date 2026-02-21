import { Shield } from '../types/shield';

export interface ShieldCalculations {
    name?: string;
    description?: string;
    price?: number;
    hpMax?: number;
    hpValue?: number | null;
    hardness?: number;
    traits?: string[];
}

/**
 * Calculate shield derived values (HP, hardness, price, description, name).
 * This function is used primarily for name and description generation.
 * HP and hardness calculations are handled in event-handler-manager.ts
 */
export function calculateShieldUpdates(shield: Shield): ShieldCalculations {
    const baseHp = shield.system.hp?.max ?? 0;
    const baseHpValue = shield.system.hp?.value ?? null;
    const baseHardness = shield.system.hardness ?? 0;
    const basePrice = shield.system.price?.value ?? 0;

    const runes = shield.system.runes || {} as any;

    // Note: HP and hardness are calculated in event-handler-manager.ts
    // This function focuses on name, description, and price
    
    const hpMax = baseHp;
    const hardness = baseHardness;
    const price = basePrice; // Price calculation would go here if needed

    // Name generation following PF2e Core Rulebook pattern:
    // Format: "+{potency} {greater/major} Hardened {property runes} {base shield name}"
    // Example: "+2 Greater Hardened Seeing Hoplon"
    
    // Extract base shield name - try from stored flag first, then parse from name
    let baseShieldName = ((shield as any).flags?.['everything-shields'] as any)?.baseShieldName;
    
    if (!baseShieldName) {
        // Parse from current name: remove runes in parentheses, then extract the last word(s) after any +
        const nameWithoutParens = shield.name?.split('(')[0].trim() ?? 'Shield';
        
        // If name has a +, take everything after the last number following the +
        if (nameWithoutParens.includes('+')) {
            // Match pattern like "+1 Hoplon" or "+2 Greater Hardened Seeing Hoplon"
            // We want to extract just "Hoplon" at the end
            const parts = nameWithoutParens.split(/\s+/);
            // The base name is everything that's not a rune-related word
            const runeWords = ['greater', 'major', 'hardened', 'reinforcing', 'seeing', 'attached', 'defiant', 'energy-resistant'];
            
            // Start from the end and find the first non-rune word that's not just a + number
            for (let i = parts.length - 1; i >= 0; i--) {
                const part = parts[i].toLowerCase();
                if (!part.startsWith('+') && !part.match(/^\d+$/) && !runeWords.includes(part)) {
                    // Found the base name - might be multiple words like "Steel Shield"
                    baseShieldName = parts.slice(i).join(' ');
                    break;
                }
            }
        } else {
            baseShieldName = nameWithoutParens;
        }
        
        baseShieldName = baseShieldName || 'Shield';
    }
    
    const nameParts: string[] = [];
    
    // 1. Add potency if present (+1, +2, +3)
    const potencyValue = runes.potency || (shield.system as any).potencyRune?.value;
    if (potencyValue) {
        nameParts.push(`+${potencyValue}`);
    }
    
    // 2. Add hardened rune with level prefix if present (Hardened, Greater Hardened, Major Hardened)
    const hardenedValue = runes.hardened || runes.resilient || (shield.system as any).resiliencyRune?.value;
    if (hardenedValue) {
        if (hardenedValue === 'greater' || hardenedValue === '2') {
            nameParts.push('Greater Hardened');
        } else if (hardenedValue === 'major' || hardenedValue === '3') {
            nameParts.push('Major Hardened');
        } else {
            nameParts.push('Hardened');
        }
    }
    
    // 3. Add property runes (pulled from propertyRune1, propertyRune2, propertyRune3)
    const propertyRunes: string[] = [];
    
    // Check both runes.property array and individual propertyRune fields
    if (Array.isArray(runes.property) && runes.property.length) {
        propertyRunes.push(...runes.property);
    } else {
        // Check individual propertyRune fields
        const prop1 = (shield.system as any).propertyRune1?.value;
        const prop2 = (shield.system as any).propertyRune2?.value;
        const prop3 = (shield.system as any).propertyRune3?.value;
        
        if (prop1) propertyRunes.push(prop1);
        if (prop2) propertyRunes.push(prop2);
        if (prop3) propertyRunes.push(prop3);
    }
    
    // Capitalize each property rune name and clean up suffixes
    const capitalizedPropertyRunes = propertyRunes.map(rune => {
        // Remove "Shield Rune" or "Rune" suffix if present
        let cleanedRune = rune.replace(/\s*Shield\s+Rune\s*$/i, '').replace(/\s*Rune\s*$/i, '').trim();
        
        // Capitalize first letter of each word
        return cleanedRune.split(/[\s-]+/).map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    });
    
    if (capitalizedPropertyRunes.length > 0) {
        nameParts.push(...capitalizedPropertyRunes);
    }
    
    // 4. Add base shield name at the end
    nameParts.push(baseShieldName);
    
    const finalName = nameParts.join(' ');

    // Description generation - simplified version
    // The full description with buttons is handled in shield-manager.ts updateShieldDescription()
    let description = shield.system.description?.value ?? '';

    return {
        name: finalName,
        description: description,
        price,
        hpMax,
        hpValue: baseHpValue,
        hardness,
        // PF2e stores traits under system.traits.value in many items
        traits: ((shield.system as any)?.traits?.value) ?? [] as string[]
    };
}
