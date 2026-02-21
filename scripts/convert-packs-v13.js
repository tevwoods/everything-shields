import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { promisify } from 'util';
import { createReadStream, writeFile } from 'fs';

const writeFileAsync = promisify(writeFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKS_DIR = path.join(__dirname, '..', 'packs');
const OUTPUT_DIR = path.join(__dirname, '..', 'packs-v13');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

// Schema updates for V13
function updateToV13Schema(doc) {
    // Handle specific document types
    if (doc.type === 'effect') {
        // Update effect schema
        if (doc.data) {
            doc.system = doc.data;
            delete doc.data;
        }
        // Update duration
        if (doc.system?.duration?.value) {
            doc.system.duration = {
                unit: "unlimited",
                sustained: false,
                expiry: null,
                ...doc.system.duration
            };
        }
    } else if (doc.type === 'feat' || doc.type === 'action') {
        // Update feat/action schema
        if (doc.data) {
            doc.system = doc.data;
            delete doc.data;
        }
        // Update prerequisites format if needed
        if (Array.isArray(doc.system?.prerequisites?.value)) {
            doc.system.prerequisites = {
                value: doc.system.prerequisites.value.map(p => typeof p === 'string' ? { value: p } : p)
            };
        }
    }

    // Common updates for all document types
    if (doc._id) {
        doc._id = doc._id.replace(/[^a-zA-Z0-9]/g, ''); // Clean ID format
    }
    
    // Update schema version
    doc.schemaVersion = 13;
    
    return doc;
}

// Process each .db file
async function convertPack(dbFile) {
    const docs = [];
    const fileStream = createReadStream(dbFile);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (line.trim()) {
            try {
                const doc = JSON.parse(line);
                docs.push(updateToV13Schema(doc));
            } catch (e) {
                console.warn(`Warning: Could not parse line in ${dbFile}:`, e.message);
            }
        }
    }

    const outputFile = path.join(
        OUTPUT_DIR,
        path.basename(dbFile, '.db') + '.json'
    );

    await writeFileAsync(outputFile, JSON.stringify(docs, null, 2));
    console.log(`Converted ${dbFile} to ${outputFile}`);
}

// Process all packs
async function convertAllPacks() {
    const dbFiles = fs.readdirSync(PACKS_DIR)
        .filter(file => file.endsWith('.db'))
        .map(file => path.join(PACKS_DIR, file));
    
    try {
        await Promise.all(dbFiles.map(convertPack));
        console.log('All packs converted successfully!');
    } catch (error) {
        console.error('Error converting packs:', error);
    }
}

// Run conversion
convertAllPacks();