import { ShieldManager } from '../shield-manager';

// Mock dependencies
jest.mock('../settings');
jest.mock('../shield-effect-manager');
jest.mock('../update-guard');

// Mock global game object
(global as any).game = {
    packs: {
        get: jest.fn()
    }
};

describe('ShieldManager - Property Rune Descriptions', () => {
    let manager: ShieldManager;
    let mockPack: any;
    let mockRuneItem: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup mock rune item
        mockRuneItem = {
            system: {
                description: {
                    value: '<p>This is the Blocking rune description. It provides defensive benefits.</p>'
                }
            }
        };

        // Setup mock pack
        mockPack = {
            index: [
                { _id: 'rune-1', name: 'Blocking' },
                { _id: 'rune-2', name: 'Reflecting' },
                { _id: 'rune-3', name: 'Spellguard' }
            ],
            getDocument: jest.fn().mockResolvedValue(mockRuneItem)
        };

        (global as any).game.packs.get = jest.fn().mockReturnValue(mockPack);
        
        manager = ShieldManager.getInstance();
    });

    describe('getPropertyRuneDescription', () => {
        it('fetches property rune description from compendium', async () => {
            const description = await (manager as any).getPropertyRuneDescription('Blocking');
            
            expect((global as any).game.packs.get).toHaveBeenCalledWith('everything-shields.everything-shields-property-runes');
            expect(mockPack.getDocument).toHaveBeenCalledWith('rune-1');
            expect(description).toBe('<p>This is the Blocking rune description. It provides defensive benefits.</p>');
        });

        it('returns null when compendium not found', async () => {
            (global as any).game.packs.get = jest.fn().mockReturnValue(null);
            
            const description = await (manager as any).getPropertyRuneDescription('Blocking');
            
            expect(description).toBeNull();
        });

        it('returns null when rune not found in compendium', async () => {
            const description = await (manager as any).getPropertyRuneDescription('NonexistentRune');
            
            expect(description).toBeNull();
        });

        it('handles case-insensitive rune name matching', async () => {
            const description = await (manager as any).getPropertyRuneDescription('blocking');
            
            expect(mockPack.getDocument).toHaveBeenCalled();
            expect(description).toBeDefined();
        });
    });

    describe('removePropertyRuneSections', () => {
        it('removes property rune div sections from description', () => {
            const description = `
                <p>Base shield description</p>
                <div class="property-rune-blocking">
                    <h3>Blocking</h3>
                    <p>Description...</p>
                </div>
                <p>More text</p>
            `;

            const cleaned = (manager as any).removePropertyRuneSections(description);
            
            expect(cleaned).toContain('Base shield description');
            expect(cleaned).toContain('More text');
            expect(cleaned).not.toContain('property-rune-blocking');
            expect(cleaned).not.toContain('<h3>Blocking</h3>');
        });

        it('removes multiple property rune sections', () => {
            const description = `
                <p>Base</p>
                <div class="property-rune-blocking">Blocking</div>
                <div class="property-rune-reflecting">Reflecting</div>
            `;

            const cleaned = (manager as any).removePropertyRuneSections(description);
            
            expect(cleaned).not.toContain('property-rune-blocking');
            expect(cleaned).not.toContain('property-rune-reflecting');
        });

        it('preserves description when no property rune sections exist', () => {
            const description = '<p>Simple shield description</p>';

            const cleaned = (manager as any).removePropertyRuneSections(description);
            
            expect(cleaned).toBe(description);
        });
    });

    describe('updateShieldTableValues', () => {
        it('updates hardness, HP, and BT values in table', () => {
            const description = `
                <p>Shield description</p>
                <table>
                    <tr>
                        <td class="everything-shields_hardness">5</td>
                        <td class="everything-shields_hit-points">20</td>
                        <td class="everything-shields_broken-threshold">10</td>
                    </tr>
                </table>
            `;

            const shield = {
                system: {
                    hp: { max: 30 },
                    hardness: 8
                }
            };

            const updated = (manager as any).updateShieldTableValues(description, shield);
            
            expect(updated).toContain('everything-shields_hardness">8</td>');
            expect(updated).toContain('everything-shields_hit-points">30</td>');
            expect(updated).toContain('everything-shields_broken-threshold">15</td>'); // BT = floor(30/2) = 15
        });

        it('handles missing table values gracefully', () => {
            const description = '<p>Shield without table</p>';

            const shield = {
                system: {
                    hp: { max: 25 },
                    hardness: 6
                }
            };

            const updated = (manager as any).updateShieldTableValues(description, shield);
            
            expect(updated).toBe(description); // Unchanged if no table
        });

        it('calculates BT as half of HP rounded down', () => {
            const description = '<td class="everything-shields_broken-threshold">0</td>';

            const shield = {
                system: {
                    hp: { max: 33 }, // 33 / 2 = 16.5, floor = 16
                    hardness: 5
                }
            };

            const updated = (manager as any).updateShieldTableValues(description, shield);
            
            expect(updated).toContain('everything-shields_broken-threshold">16</td>');
        });
    });

    describe('updateShieldDescription - property runes', () => {
        it('includes property rune descriptions in shield description', async () => {
            // This is an integration test showing how property runes should be handled
            const mockShield: any = {
                id: 'shield-1',
                system: {
                    description: { value: '<p>Base description</p>' },
                    potencyRune: { value: '1' },
                    resiliencyRune: { value: null },
                    propertyRune1: { value: 'Blocking' },
                    propertyRune2: { value: null },
                    propertyRune3: { value: null }
                },
                parent: { id: 'actor-1' },
                update: jest.fn()
            };

            // Mock the settings
            const mockSettings: any = {
                getSetting: jest.fn().mockReturnValue(true)
            };
            (manager as any).settings = mockSettings;

            // Mock UpdateGuard
            const UpdateGuard = require('../update-guard').UpdateGuard;
            UpdateGuard.runExclusive = jest.fn((id, fn) => fn());

            await manager.updateShieldDescription(mockShield);

            // Verify update was called with description containing property rune
            expect(mockShield.update).toHaveBeenCalled();
            const updateCall = mockShield.update.mock.calls[0][0];
            const updatedDescription = updateCall['system.description.value'];

            expect(updatedDescription).toContain('property-rune-blocking');
            expect(updatedDescription).toContain('<h3>Blocking</h3>');
            expect(updatedDescription).toContain('This is the Blocking rune description');
            expect(updatedDescription).toContain('everything-shields-remove-property-rune');
            expect(updatedDescription).toContain('data-shield-property-rune-name="Blocking"');
        });
    });
});
