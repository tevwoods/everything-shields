export interface Shield {
    id: string;
    name: string;
    type: string;
    system: {
        price: {
            value: number;
        };
        description: {
            value: string;
        };
        hp: {
            value: number;
            max: number;
            brokenThreshold: number;
        };
        hardness: number;
        potencyRune?: {
            value: string | null;
        };
        resiliencyRune?: {
            value: string | null;
        };
        propertyRune1?: {
            value: string | null;
        };
        propertyRune2?: {
            value: string | null;
        };
        propertyRune3?: {
            value: string | null;
        };
        runes?: {
            property?: string[];
            potency?: number;
            hardened?: number;
            reinforcing?: number;
        };
    };
    effects?: ActiveEffect[];
    createEmbeddedDocuments(type: string, data: any[]): Promise<void>;
    deleteEmbeddedDocuments(type: string, ids: string[]): Promise<void>;
    update(data: Record<string, any>): Promise<void>;
}

export interface ShieldParent {
    id: string;
    items: Shield[];
    updateEmbeddedDocuments(type: string, data: any[]): Promise<void>;
}

export type RuneType = 'property' | 'potency' | 'hardened' | 'reinforcing';

export interface RuneRemovalOptions {
    shieldParentId: string;
    shieldId: string;
    runeName?: string;
    runeType?: RuneType;
}