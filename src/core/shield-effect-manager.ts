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
                // PF2e derives reinforcing HP and hardness from system.runes.reinforcing.
                return;
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

        await shield.update({ 'system.hp.value': newHp });

        // PF2e derives the shield's broken state from HP and broken threshold.
    }

    public async applyBrokenEffect(shield: Shield): Promise<void> {
        return;
    }

    public async repair(shield: Shield, amount: number): Promise<void> {
        const currentHp = shield.system.hp.value;
        const maxHp = shield.system.hp.max;
        const newHp = Math.min(maxHp, currentHp + amount);

        await shield.update({ 'system.hp.value': newHp });

        // PF2e derives the shield's broken state from HP and broken threshold.
    }
}