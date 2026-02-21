export default class ModuleSettings {
    moduleName = 'everything-shields';
    shouldGenerateShieldNamesName = 'should-generate-shield-names';
    shouldCalculateShieldPricesName = 'should-calculate-shield-prices';
    disableAllAutomationsName = 'disable-all-automations';
    shouldApplyRecommendedChangesToSpecificShieldsName = 'should-apply-recommended-changes-to-specific-shields';
    shouldGenerateShieldDescriptionsName = 'should-generate-shield-descriptions';
    useReinforcingRuneInsteadOfPotencyAndHardenedName = 'use-reinforcing-rune-instead-of-potency-and-hardened';

    registerSettings() {
        game.settings.register(this.moduleName, this.disableAllAutomationsName, {
            name: 'Disable All Automations',
            hint: 'Activate this setting to disable all automatic calculations this module would normally make: hardened runes, potency runes, and property runes will be treated as plain items and you will not be asked if you want to combine them with shields. This will override all other settings.',
            scope: 'client',
            config: true,
            type: Boolean,
            default: false
        })

        game.settings.register(this.moduleName, this.shouldGenerateShieldNamesName, {
            name: 'Generate Shield Names',
            hint: 'When this is enabled, then shield names will be generated automatically based on the fundamental and property runes applied to them, as well as their precious materials. Disable this if you do not want this module to change the names of your shields.',
            scope: 'client',
            config: true,
            type: Boolean,
            default: true
        });

        game.settings.register(this.moduleName, this.shouldGenerateShieldDescriptionsName, {
            name: 'Generate Shield Descriptions',
            hint: 'When this is enabled, the description of the shield will have parts generated: descriptions of property runes that are applied to the shield, as well as buttons that allow you to remove the applied fundamental and property runes from the shield.',
            scope: 'client',
            config: true,
            type: Boolean,
            default: true,
        });
    
        game.settings.register(this.moduleName, this.shouldCalculateShieldPricesName, {
            name: 'Calculate Shield Prices',
            hint: 'When this is enabled, the Price property of each shield will be calculated automatically starting with the original price of the shield, and adding value based on the shield\'s current runes and precious materials. Disable this if you do not want this module to calculate the prices of your shields.',
            scope: 'client',
            config: true,
            type: Boolean,
            default: true
        });

        game.settings.register(this.moduleName, this.shouldApplyRecommendedChangesToSpecificShieldsName, {
            name: 'Automate Specific Shields',
            hint: 'When this is enabled, applying fundamental shield runes to Specific Magic Shields (such as Forge Warden or Arrow-Catching Shield), will first reduce those shields\' base stats to the standard stats for their shield type, and then treat their bonus from the base the same as if it were precious materials, as recommended in Everything Shields.',            scope: 'client',
            config: true,
            type: Boolean,
            default: true
        });

        game.settings.register(this.moduleName, this.useReinforcingRuneInsteadOfPotencyAndHardenedName, {
            name: "Use Reinforcing Rune Instead of Shield Potency and Hardened Runes",
            hint: "When this is enabled, the Shield Potency runes and Hardened runes provided by this supplement will no longer function, and Shield Property runes will be combinable with the reinforcing runes that are included with the system since the remaster.",
            config: true,
            type: Boolean,
            default: false
        });
    }

    setSetting(setting, value) {
        game.settings.set(this.moduleName, setting, value);
    }

    getSetting(setting) {
        return game.settings.get(this.moduleName, setting);
    }

    set shouldGenerateShieldNames(value) {
        this.setSetting(this.shouldGenerateShieldNamesName, value);
    }

    get shouldGenerateShieldNames() {
        return this.getSetting(this.shouldGenerateShieldNamesName);
    }

    set shouldGenerateShieldDescriptions(value) {
        this.setSetting(this.shouldGenerateShieldDescriptionsName, value);
    }

    get shouldGenerateShieldDescriptions() {
        return this.getSetting(this.shouldGenerateShieldDescriptionsName);
    }

    set shouldCalculateShieldPrices(value) {
        this.setSetting(this.shouldCalculateShieldPricesName, value);
    }

    get shouldCalculateShieldPrices() {
        return this.getSetting(this.shouldCalculateShieldPricesName);
    }

    set disableAllAutomations(value) {
        this.setSetting(this.disableAllAutomationsName, value);
    }

    get disableAllAutomations() {
        return this.getSetting(this.disableAllAutomationsName);
    }

    set shouldApplyRecommendedChangesToSpecificShields(value) {
        this.setSetting(this.shouldApplyRecommendedChangesToSpecificShieldsName, value);
    }

    get shouldApplyRecommendedChangesToSpecificShields() {
        return this.getSetting(this.shouldApplyRecommendedChangesToSpecificShieldsName);
    }

    get useReinforcingRuneInsteadOfPotencyAndHardened() {
        return this.getSetting(this.useReinforcingRuneInsteadOfPotencyAndHardenedName);
    }

    set useReinforcingRuneInsteadOfPotencyAndHardened(value) {
        this.setSetting(this.useReinforcingRuneInsteadOfPotencyAndHardenedName, value);
    }

    constructor() {
        this.registerSettings();
    }
}