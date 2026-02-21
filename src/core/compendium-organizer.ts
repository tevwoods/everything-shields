declare global {
    interface Collection<T> {
        find(predicate: (item: T) => boolean): T | undefined;
        filter(predicate: (item: T) => boolean): T[];
    }

    interface Game {
        folders: Collection<Folder>;
        packs: Collection<CompendiumPack>;
    }

    interface CompendiumPack {
        metadata: {
            packageName: string;
        };
        folder?: {
            id: string;
        };
        setFolder(folderId: string): Promise<void>;
    }

    interface Folder {
        id: string;
        type: string;
        name: string;
    }

    namespace globalThis {
        var Folder: {
            create(data: {
                name: string;
                type: string;
                parent: string | null;
                color?: string;
            }): Promise<Folder>;
        };
    }
}

export async function organizeCompendiums(): Promise<void> {
    const FOLDER_NAME = "Everything Shields";
    const MODULE_ID = "everything-shields";
    
    // Check if folders are already organized
    const existingFolder = game.folders.find((f: Folder) => 
        f.type === "Compendium" && 
        f.name === FOLDER_NAME &&
        game.packs.filter((p: CompendiumPack) => p.metadata.packageName === MODULE_ID && p.folder?.id === f.id).length > 0
    );
    
    // If folder exists and contains our packs, we're done
    if (existingFolder) {
        console.log('Everything Shields | Compendiums already organized');
        return;
    }
    
    // Create the folder
    console.log('Everything Shields | Creating compendium folder');
    const folder = await Folder.create({
        name: FOLDER_NAME,
        type: "Compendium",
        parent: null,
        color: "#FFA500" // Orange color
    });
    
    // Get all compendium packs from the module
    const packs = game.packs.filter((p: CompendiumPack) => p.metadata.packageName === MODULE_ID);
    
    // Move each pack to the folder
    for (const pack of packs) {
        await pack.setFolder(folder.id);
    }
    
    console.log(`Everything Shields | Organized ${packs.length} compendiums into "${FOLDER_NAME}" folder`);
}