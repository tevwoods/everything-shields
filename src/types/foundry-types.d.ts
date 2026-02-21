import { Shield } from './shield';

export interface ActorSheet {
    actor: Actor;
    render: (force?: boolean) => void;
}

export interface Actor {
    id: string;
    items: Item[];
    update: (data: any) => Promise<void>;
    createEmbeddedDocuments: (type: string, data: any[]) => Promise<void>;
    updateEmbeddedDocuments: (type: string, data: any[]) => Promise<void>;
    deleteEmbeddedDocuments: (type: string, data: string[]) => Promise<void>;
}

export interface Item {
    id: string;
    type: string;
    name: string;
    system: any;
    update: (data: any) => Promise<void>;
}

export interface DragData {
    type: string;
    uuid: string;
    data?: any;
}

export interface UpdateData {
    _id: string;
    [key: string]: any;
}

export interface DocumentModificationContext {
    parent?: any;
    pack?: string;
    noHook?: boolean;
    index?: boolean;
    strict?: boolean;
    temporary?: boolean;
    render?: boolean;
    renderSheet?: boolean;
    diff?: boolean;
    recursive?: boolean;
    isUndo?: boolean;
    [key: string]: any;
}