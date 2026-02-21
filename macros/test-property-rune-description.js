/**
 * Everything Shields - Property Rune Description Test
 * 
 * Tests that property rune descriptions are added to shield descriptions
 */

(async () => {
    console.log('=== Testing Property Rune Descriptions ===');
    
    try {
        // Find or create test actor
        let actor = game.actors.find(a => a.type === 'character');
        
        if (!actor) {
            console.log('Creating test character...');
            actor = await Actor.create({
                name: 'Property Rune Test Character',
                type: 'character'
            });
        }
        
        console.log(`Using actor: ${actor.name}`);
        
        // Create a test shield
        const shieldData = {
            name: 'Test Shield',
            type: 'armor',
            system: {
                category: 'shield',
                armor: { value: 2 },
                hp: { value: 20, max: 20 },
                hardness: 5,
                price: { value: { gp: 10, sp: 0, cp: 0, pp: 0 }, per: 1 },
                level: { value: 0 },
                description: { value: '<p>A basic test shield for testing property runes.</p>' },
                potencyRune: { value: null },
                resiliencyRune: { value: null },
                propertyRune1: { value: null },
                propertyRune2: { value: null },
                propertyRune3: { value: null }
            }
        };
        
        const [shield] = await actor.createEmbeddedDocuments('Item', [shieldData]);
        console.log(`✓ Created shield: ${shield.name}`);
        
        // Add a +1 potency rune (required for property runes)
        await shield.update({ 'system.potencyRune.value': '1' });
        console.log('✓ Added +1 potency rune');
        
        // Reload shield
        let reloadedShield = actor.items.get(shield.id);
        
        // Add a property rune directly
        console.log('Adding property rune: Blocking');
        await reloadedShield.update({ 'system.propertyRune1.value': 'Blocking' });
        
        // Trigger description update
        console.log('Triggering description update...');
        reloadedShield = actor.items.get(shield.id);
        
        if (game.pf2e?.EverythingShields?.UpdateShieldDescription) {
            await game.pf2e.EverythingShields.UpdateShieldDescription(reloadedShield);
            console.log('✓ Called UpdateShieldDescription');
        } else {
            console.warn('UpdateShieldDescription not available - testing direct method');
        }
        
        // Reload again and check description
        reloadedShield = actor.items.get(shield.id);
        const description = reloadedShield.system.description?.value || '';
        
        console.log('\n--- Shield Description ---');
        console.log(description);
        console.log('--- End Description ---\n');
        
        // Check if property rune description is present
        const hasBlockingDescription = description.toLowerCase().includes('blocking');
        const hasPropertyRuneDiv = description.includes('property-rune-blocking');
        const hasRemoveButton = description.includes('everything-shields-remove-property-rune');
        
        console.log('\n=== Test Results ===');
        console.log(`Contains "blocking": ${hasBlockingDescription ? '✓' : '✗'}`);
        console.log(`Has property rune div: ${hasPropertyRuneDiv ? '✓' : '✗'}`);
        console.log(`Has remove button: ${hasRemoveButton ? '✓' : '✗'}`);
        
        if (hasBlockingDescription && hasPropertyRuneDiv && hasRemoveButton) {
            ui.notifications.info('✓ Property rune description test PASSED');
            console.log('✓ TEST PASSED: Property rune description added successfully');
        } else {
            ui.notifications.warn('✗ Property rune description test FAILED');
            console.log('✗ TEST FAILED: Property rune description not properly added');
        }
        
        // Clean up
        console.log('\nCleaning up test shield...');
        await actor.deleteEmbeddedDocuments('Item', [shield.id]);
        console.log('✓ Test shield deleted');
        
    } catch (error) {
        console.error('Test failed with error:', error);
        ui.notifications.error(`Test failed: ${error.message}`);
    }
})();
