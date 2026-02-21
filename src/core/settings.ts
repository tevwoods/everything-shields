import { handleError } from './errors';

export interface ModuleSettingsConfig {
    shouldGenerateShieldNames: boolean;
    shouldCalculateShieldPrices: boolean;
    disableAllAutomations: boolean;
    shouldApplyRecommendedChangesToSpecificShields: boolean;
    shouldGenerateShieldDescriptions: boolean;
    useReinforcingRuneInsteadOfPotencyAndHardened: boolean;
}

export class SettingsManager {
    private static instance: SettingsManager;
    private readonly MODULE_NAME = 'everything-shields';

    private constructor() {
        // Settings will be registered explicitly during init
    }

    public static getInstance(): SettingsManager {
        if (!SettingsManager.instance) {
            SettingsManager.instance = new SettingsManager();
        }
        return SettingsManager.instance;
    }

    public init(): void {
        this.registerSettings();
    }

    private registerSettings(): void {
        try {
            const settings: Record<string, any> = {
                'disable-all-automations': {
                    name: 'Disable All Automations',
                    hint: 'Activate this setting to disable all automatic calculations.',
                    default: false,
                },
                'should-generate-shield-names': {
                    name: 'Generate Shield Names',
                    hint: 'Automatically generate shield names based on runes and materials.',
                    default: true,
                },
                'should-generate-shield-descriptions': {
                    name: 'Generate Shield Descriptions',
                    hint: 'Automatically generate shield descriptions with rune information.',
                    default: true,
                },
                'should-calculate-shield-prices': {
                    name: 'Calculate Shield Prices',
                    hint: 'Automatically calculate shield prices based on runes and materials.',
                    default: true,
                },
                'should-apply-recommended-changes-to-specific-shields': {
                    name: 'Automate Specific Shields',
                    hint: 'Apply recommended changes to specific magic shields.',
                    default: true,
                },
                'use-reinforcing-rune-instead-of-potency-and-hardened': {
                    name: 'Use Reinforcing Rune',
                    hint: 'Use reinforcing rune instead of shield potency and hardened runes.',
                    default: false,
                }
            };

            Object.entries(settings).forEach(([key, setting]) => {
                game.settings.register(this.MODULE_NAME, key, {
                    name: setting.name,
                    hint: setting.hint,
                    scope: 'client',
                    config: true,
                    type: Boolean,
                    default: setting.default,
                });
            });
        } catch (error) {
            handleError(error as Error);
        }
    }

    public getSetting<T>(key: string): T {
        try {
            return game.settings.get(this.MODULE_NAME, key) as T;
        } catch (error) {
            handleError(error as Error);
            return undefined as unknown as T;
        }
    }

    public async setSetting<T>(key: string, value: T): Promise<void> {
        try {
            await game.settings.set(this.MODULE_NAME, key, value);
        } catch (error) {
            handleError(error as Error);
        }
    }

    public getConfig(): ModuleSettingsConfig {
        return {
            shouldGenerateShieldNames: this.getSetting('should-generate-shield-names'),
            shouldCalculateShieldPrices: this.getSetting('should-calculate-shield-prices'),
            disableAllAutomations: this.getSetting('disable-all-automations'),
            shouldApplyRecommendedChangesToSpecificShields: this.getSetting('should-apply-recommended-changes-to-specific-shields'),
            shouldGenerateShieldDescriptions: this.getSetting('should-generate-shield-descriptions'),
            useReinforcingRuneInsteadOfPotencyAndHardened: this.getSetting('use-reinforcing-rune-instead-of-potency-and-hardened'),
        };
    }
}