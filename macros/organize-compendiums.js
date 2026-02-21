// Organize Everything Shields Compendiums
async function organizeCompendiums() {
    const FOLDER_NAME = "Everything Shields";
    const MODULE_ID = "everything-shields";
    
    // Create or find the folder
    let folder = game.folders.find(f => f.type === "Compendium" && f.name === FOLDER_NAME);
    if (!folder) {
        folder = await Folder.create({
            name: FOLDER_NAME,
            type: "Compendium",
            parent: null,
            color: "#FFA500" // Orange color
        });
    }
    
    // Get all compendium packs from the module
    const packs = game.packs.filter(p => p.metadata.packageName === MODULE_ID);
    
    // Move each pack to the folder
    for (const pack of packs) {
        await pack.setFolder(folder.id);
    }
    
    ui.notifications.info(`Organized ${packs.length} Everything Shields compendiums into the "${FOLDER_NAME}" folder.`);
}

// Run the organization
organizeCompendiums();