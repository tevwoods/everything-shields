import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const effectsPath = join(__dirname, '../packs/Everything Shields/everything-shields-effects.json');

// Read the effects file
const effectsContent = readFileSync(effectsPath, 'utf8');
const effects = JSON.parse(effectsContent);

// Update each effect
const updatedEffects = effects.map(effect => {
    if (effect.type === 'effect') {
        return {
            ...effect,
            type: 'item',
            system: {
                ...effect.system,
                schema: {
                    version: 0.854,
                    lastMigration: {
                        version: {
                            schema: 0.854
                        }
                    }
                },
                slug: effect.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                description: {
                    value: effect.description || ''
                },
                traits: {
                    value: [],
                    rarity: "common"
                },
                rules: effect.rules || [],
                _migration: {
                    version: 0.854
                }
            }
        };
    }
    return effect;
});

// Write back to file
writeFileSync(effectsPath, JSON.stringify(updatedEffects, null, 2));