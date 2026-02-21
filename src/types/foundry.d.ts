declare interface Game {
    pf2e: {
        EverythingShields: {
            RemovePropertyRune: (shieldParentId: string, shieldId: string, runeName: string) => Promise<void>;
            RemoveHardenedRune: (shieldParentId: string, shieldId: string) => Promise<void>;
            RemovePotencyRune: (shieldParentId: string, shieldId: string) => Promise<void>;
        }
    };
    settings: {
        register: (module: string, key: string, data: any) => void;
        get: (module: string, key: string) => any;
        set: (module: string, key: string, value: any) => Promise<void>;
    };
    actors?: any[];
}

declare const game: Game;

declare interface Hooks {
    on(hook: string, callback: Function): void;
    once(hook: string, callback: Function): void;
}

declare const Hooks: Hooks;

declare interface ui {
    notifications: {
        error: (message: string) => void;
        info: (message: string) => void;
        warn: (message: string) => void;
    }
}

declare const ui: ui;

declare interface Dialog {
    confirm(options: {
        title: string;
        content: string;
        yes?: () => any;
        no?: () => any;
        defaultYes?: boolean;
    }): Promise<boolean>;
}

declare const Dialog: Dialog;

// Helper function provided by Foundry
declare function fromUuid(uuid: string): Promise<any>;