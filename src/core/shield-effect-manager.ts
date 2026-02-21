import { Shield } from '../types/shield';

export interface ShieldEffect {
    id: string;
    label: string;
    icon: string;
    duration: {
        rounds?: number;
        seconds?: number;
        turns?: number;
        startTime?: number;
        startRound?: number;
        startTurn?: number;
    };
    changes: EffectChange[];
}

export interface EffectChange {
    key: string;
    mode: 0 | 1 | 2 | 3 | 4 | 5; // CUSTOM, MULTIPLY, ADD, DOWNGRADE, UPGRADE, OVERRIDE
    value: string | number;
    priority?: number;
}

export class ShieldEffectManager {
    private static instance: ShieldEffectManager;

    private constructor() {}

    public static getInstance(): ShieldEffectManager {
        if (!ShieldEffectManager.instance) {
            ShieldEffectManager.instance = new ShieldEffectManager();
        }
        return ShieldEffectManager.instance;
    }

    public async applyRuneEffect(shield: Shield, runeType: string, value: number): Promise<void> {
        const effect: ShieldEffect = {
            id: `${shield.id}-${runeType}-${Date.now()}`,
            label: `Shield ${runeType.charAt(0).toUpperCase() + runeType.slice(1)} Rune`,
            icon: 'systems/pf2e/icons/effects/rune.webp',
            duration: {}, // Permanent until removed
            changes: []
        };

        switch (runeType) {
            case 'reinforcing':
                effect.changes = [
                    {
                        key: 'system.hardness',
                        mode: 2, // ADD mode
                        value: value * 2 // Reinforcing adds 2 hardness per level
                    },
                    {
                        key: 'system.hp.max',
                        mode: 2, // ADD mode
                        value: value * 20 // Reinforcing adds 20 HP per level
                    }
                ];
                break;
            case 'potency':
                effect.changes = [
                    {
                        key: 'system.runes.potency',
                        mode: 5, // OVERRIDE mode
                        value: value
                    }
                ];
                break;
            case 'hardened':
                effect.changes = [
                    {
                        key: 'system.hardness',
                        mode: 2, // ADD mode
                        value: value * 2 // Hardened adds 2 hardness per level
                    }
                ];
                break;
        }

        await this.addEffect(shield, effect);
    }

    private async addEffect(shield: Shield, effect: ShieldEffect): Promise<void> {
        // Use Foundry's effect system to apply the effect
        await shield.createEmbeddedDocuments('ActiveEffect', [effect]);
    }

    public async removeEffect(shield: Shield, effectId: string): Promise<void> {
        await shield.deleteEmbeddedDocuments('ActiveEffect', [effectId]);
    }

    public async applyDamage(shield: Shield, damage: number): Promise<void> {
        const currentHp = shield.system.hp.value;
        const newHp = Math.max(0, currentHp - damage);

        const effect: ShieldEffect = {
            id: `${shield.id}-damage-${Date.now()}`,
            label: 'Shield Damage',
            icon: 'systems/pf2e/icons/effects/damaged.webp',
            duration: {},
            changes: [
                {
                    key: 'system.hp.value',
                    mode: 5, // OVERRIDE mode
                    value: newHp
                }
            ]
        };

        await this.addEffect(shield, effect);

        // Check for broken threshold
        if (newHp <= shield.system.hp.brokenThreshold) {
            await this.applyBrokenEffect(shield);
        }
    }

    public async applyBrokenEffect(shield: Shield): Promise<void> {
        const effect: ShieldEffect = {
            id: `${shield.id}-broken`,
            label: 'Shield Broken',
            icon: 'systems/pf2e/icons/effects/broken.webp',
            duration: {},
            changes: [
                {
                    key: 'system.traits.value',
                    mode: 0, // CUSTOM mode - add trait
                    value: 'broken'
                }
            ]
        };

        await this.addEffect(shield, effect);
    }

    public async repair(shield: Shield, amount: number): Promise<void> {
        const currentHp = shield.system.hp.value;
        const maxHp = shield.system.hp.max;
        const newHp = Math.min(maxHp, currentHp + amount);

        const effect: ShieldEffect = {
            id: `${shield.id}-repair-${Date.now()}`,
            label: 'Shield Repair',
            icon: 'systems/pf2e/icons/effects/repaired.webp',
            duration: {},
            changes: [
                {
                    key: 'system.hp.value',
                    mode: 5, // OVERRIDE mode
                    value: newHp
                }
            ]
        };

        await this.addEffect(shield, effect);

        // Remove broken effect if HP is above broken threshold
        if (newHp > shield.system.hp.brokenThreshold) {
            const brokenEffect = shield.effects?.find(e => e.id === `${shield.id}-broken`);
            if (brokenEffect) {
                await this.removeEffect(shield, brokenEffect.id);
            }
        }
    }
}