import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const packsDir = path.join(rootDir, 'packs', 'Everything-Shields');

// V13 schema version
const CURRENT_SCHEMA_VERSION = 0.930; // Update this to match PF2e V13
const FOUNDRY_VERSION = "13";
const SYSTEM_VERSION = "6.0.0"; // Update this to match your PF2e version

function migrateShieldToV13(shield) {
    // Update schema version
    if (shield.system && shield.system.schema) {
        shield.system.schema.version = CURRENT_SCHEMA_VERSION;
        shield.system.schema.lastMigration = {
            datetime: new Date().toISOString(),
            version: {
                schema: CURRENT_SCHEMA_VERSION,
                foundry: FOUNDRY_VERSION,
                system: SYSTEM_VERSION
            }
        };
    }

    // Ensure proper armor structure for shields
    if (shield.type === 'armor' && shield.system.category === 'shield') {
        // Remove any legacy 'type: shield' references
        delete shield.system.type;
        
        // Ensure all required V13 fields are present
        if (!shield.system.baseItem) {
            shield.system.baseItem = null;
        }
        
        // Update _stats to V13
        if (shield._stats) {
            shield._stats.systemVersion = SYSTEM_VERSION;
            shield._stats.coreVersion = FOUNDRY_VERSION;
            shield._stats.modifiedTime = Date.now();
        }
    }

    return shield;
}

function migrateItemToV13(item) {
    // Update schema version for all item types
    if (item.system && item.system.schema) {
        item.system.schema.version = CURRENT_SCHEMA_VERSION;
        item.system.schema.lastMigration = {
            datetime: new Date().toISOString(),
            version: {
                schema: CURRENT_SCHEMA_VERSION,
                foundry: FOUNDRY_VERSION,
                system: SYSTEM_VERSION
            }
        };
    }

    // Update _stats to V13
    if (item._stats) {
        item._stats.systemVersion = SYSTEM_VERSION;
        item._stats.coreVersion = FOUNDRY_VERSION;
        item._stats.modifiedTime = Date.now();
    }

    return item;
}

function migrateCompendium(filename) {
    const filePath = path.join(packsDir, filename);
    
    if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${filename} - file not found`);
        return;
    }

    console.log(`Migrating ${filename}...`);
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    let migratedData;
    if (filename.includes('shields')) {
        // Special handling for shields
        migratedData = data.map(migrateShieldToV13);
    } else {
        // Generic item migration
        migratedData = data.map(migrateItemToV13);
    }
    
    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(migratedData, null, 2), 'utf8');
    console.log(`✓ Migrated ${filename} - ${migratedData.length} items`);
}

// Migrate all compendium files
const compendiumFiles = [
    'everything-shields-actions.json',
    'everything-shields-adjustments.json',
    'everything-shields-archetypes.json',
    'everything-shields-effects.json',
    'everything-shields-fundamental-runes.json',
    'everything-shields-general-feats.json',
    'everything-shields-guide.json',
    'everything-shields-property-runes.json',
    'everything-shields-shields.json'
];

console.log('Starting V13 compendium migration...\n');

compendiumFiles.forEach(migrateCompendium);

console.log('\n✓ All compendiums migrated to V13 format');
