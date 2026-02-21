/**
 * Everything Shields - Integration Test Macro
 * 
 * Create this as a Script macro in Foundry VTT
 * Run it to test shield rune operations and report results
 */

(async () => {
    const results = [];
    
    function log(message, isError = false) {
        console.log(message);
        results.push({ message, isError });
    }
    
    function logSection(title) {
        console.log('\n' + '='.repeat(60));
        console.log(title);
        console.log('='.repeat(60));
        log(`<h3>${title}</h3>`);
    }
    
    try {
        logSection('EVERYTHING SHIELDS - INTEGRATION TEST');
        
        // Find or create test actor
        let actor = game.actors.find(a => a.type === 'character');
        
        if (!actor) {
            log('No player character found - creating test character...');
            actor = await Actor.create({
                name: 'Everything Shields Test Character',
                type: 'character'
            });
            log(`✓ Created test character: <strong>${actor.name}</strong>`);
        } else {
            log(`Using existing character: <strong>${actor.name}</strong>`);
        }
        
        // Find Everything Shields compendium
        const compendium = game.packs.find(p => 
            p.metadata.name === 'everything-shields-shields' || 
            p.metadata.label?.includes('Everything Shields')
        );
        
        if (!compendium) {
            throw new Error('Everything Shields compendium not found');
        }
        
        log(`Found compendium: <strong>${compendium.metadata.label}</strong>`);
        
        // Get a shield from compendium (preferably a basic one)
        await compendium.getDocuments();
        const compendiumShields = compendium.index.contents;
        
        // Try to find a basic shield like Hoplon or Buckler
        let shieldDoc = compendiumShields.find(s => 
            s.name.toLowerCase().includes('hoplon') || 
            s.name.toLowerCase().includes('buckler')
        ) || compendiumShields[0];
        
        if (!shieldDoc) {
            throw new Error('No shields found in compendium');
        }
        
        log(`Selected shield from compendium: <strong>${shieldDoc.name}</strong>`);
        
        // Get the full document
        const shieldData = await compendium.getDocument(shieldDoc._id);
        
        // Create shield in actor's inventory
        const [createdShield] = await actor.createEmbeddedDocuments('Item', [shieldData.toObject()]);
        let shield = createdShield;
        
        log(`✓ Created fresh shield in inventory: <strong>${shield.name}</strong>`);
        
        logSection('INITIAL STATE');
        
        // Get price as number for display
        const initialPriceRaw = shield.system.price?.value;
        let initialPrice = 0;
        if (typeof initialPriceRaw === 'number') {
            initialPrice = initialPriceRaw;
        } else if (initialPriceRaw && typeof initialPriceRaw === 'object' && initialPriceRaw.copperValue !== undefined) {
            initialPrice = initialPriceRaw.copperValue / 100;
        }
        
        log(`Price: ${initialPrice} gp`);
        log(`Level: ${shield.system.level?.value}`);
        log(`HP: ${shield.system.hp?.max}/${shield.system.hp?.max}`);
        log(`Hardness: ${shield.system.hardness}`);
        log(`Flags preserved: ${shield.flags?.['everything-shields']?.hitPoints ? 'Yes' : 'No'}`);
        
        // Test: Preserve initial values
        logSection('TEST 1: PRESERVE INITIAL VALUES');
        
        if (!shield.flags?.['everything-shields']?.hitPoints) {
            const rawPrice = shield.system.price?.value;
            let priceValue = 0;
            
            if (typeof rawPrice === 'number') {
                priceValue = rawPrice;
            } else if (rawPrice && typeof rawPrice === 'object' && rawPrice.copperValue !== undefined) {
                priceValue = rawPrice.copperValue / 100;
            }
            
            await shield.update({
                'flags.everything-shields.hitPoints': shield.system.hp.max,
                'flags.everything-shields.hardness': shield.system.hardness,
                'flags.everything-shields.name': shield.name,
                'flags.everything-shields.price': priceValue,
                'flags.everything-shields.level': shield.system.level?.value || 0,
            });
            
            // Reload shield
            shield = actor.items.get(shield.id);
            
            log('✓ Initial values preserved');
            log(`Base price saved: ${shield.flags['everything-shields'].price} gp`);
        } else {
            log('✓ Initial values already preserved');
            log(`Base price: ${shield.flags['everything-shields'].price} gp`);
        }
        
        // Test: Apply potency rune
        logSection('TEST 2: APPLY +1 POTENCY RUNE');
        
        await shield.update({
            'system.potencyRune.value': '1'
        });
        
        // Reload shield
        shield = actor.items.get(shield.id);
        log('✓ Potency rune field updated');
        
        // Test: Calculate and update price
        logSection('TEST 3: UPDATE PRICE AND LEVEL');
        
        const basePriceRaw = shield.flags?.['everything-shields']?.price;
        let basePrice = 0;
        
        if (typeof basePriceRaw === 'number') {
            basePrice = basePriceRaw;
        } else if (basePriceRaw && typeof basePriceRaw === 'object' && basePriceRaw.copperValue !== undefined) {
            basePrice = basePriceRaw.copperValue / 100;
        }
        
        const runePrice = 35; // +1 potency
        const expectedPrice = basePrice + runePrice;
        const expectedLevel = Math.max(shield.flags?.['everything-shields']?.level || 0, 3);
        
        // Handle price format for update
        const currentPrice = shield.system.price?.value;
        let priceUpdate;
        
        if (typeof currentPrice === 'object' && currentPrice !== null && currentPrice.copperValue !== undefined) {
            priceUpdate = { copperValue: expectedPrice * 100 };
        } else {
            priceUpdate = expectedPrice;
        }
        
        await shield.update({
            'system.price.value': priceUpdate,
            'system.level.value': expectedLevel
        });
        
        // Reload shield
        shield = actor.items.get(shield.id);
        
        // Get actual price as number for comparison
        const actualPriceRaw = shield.system.price?.value;
        let actualPrice = 0;
        
        if (typeof actualPriceRaw === 'number') {
            actualPrice = actualPriceRaw;
        } else if (actualPriceRaw && typeof actualPriceRaw === 'object' && actualPriceRaw.copperValue !== undefined) {
            actualPrice = actualPriceRaw.copperValue / 100;
        }
        
        log(`Base price: ${basePrice} gp`);
        log(`Rune price: ${runePrice} gp`);
        log(`Expected total: ${expectedPrice} gp`);
        log(`Actual price: ${actualPrice} gp`);
        log(`Price match: ${actualPrice === expectedPrice ? '✓ YES' : '✗ NO'}`, 
            actualPrice !== expectedPrice);
        log(`Expected level: ${expectedLevel}`);
        log(`Actual level: ${shield.system.level?.value}`);
        log(`Level match: ${shield.system.level?.value === expectedLevel ? '✓ YES' : '✗ NO'}`,
            shield.system.level?.value !== expectedLevel);
        
        // Test: Add description buttons
        logSection('TEST 4: DESCRIPTION BUTTONS');
        
        let description = shield.system.description?.value || '';
        const parentActorId = shield.parent?.id;
        
        log(`Parent actor ID: ${parentActorId}`);
        
        if (parentActorId) {
            description += '<div class="dialog-buttons everything-shields-buttons">';
            description += `<button class="dialog-button everything-shields-button everything-shields-remove-potency-rune" data-shield-id="${shield.id}" data-shield-parent-id="${parentActorId}">Remove +1 Shield Potency Rune</button>`;
            description += '</div>';
            
            await shield.update({
                'system.description.value': description
            });
            
            // Reload shield
            shield = actor.items.get(shield.id);
            
            const hasButtons = shield.system.description.value.includes('everything-shields-button');
            log(`Buttons added: ${hasButtons ? '✓ YES' : '✗ NO'}`, !hasButtons);
            
            if (hasButtons) {
                const buttonMatch = shield.system.description.value.match(/data-shield-parent-id="([^"]+)"/);
                if (buttonMatch) {
                    log(`Button parent ID: ${buttonMatch[1]}`);
                    log(`ID matches: ${buttonMatch[1] === parentActorId ? '✓ YES' : '✗ NO'}`,
                        buttonMatch[1] !== parentActorId);
                }
            }
        } else {
            log('✗ No parent actor ID found!', true);
        }
        
        // Final state
        logSection('FINAL STATE');
        
        // Get final price as number for display
        const finalPriceRaw = shield.system.price?.value;
        let finalPrice = 0;
        if (typeof finalPriceRaw === 'number') {
            finalPrice = finalPriceRaw;
        } else if (finalPriceRaw && typeof finalPriceRaw === 'object' && finalPriceRaw.copperValue !== undefined) {
            finalPrice = finalPriceRaw.copperValue / 100;
        }
        
        log(`Name: ${shield.name}`);
        log(`Price: ${finalPrice} gp`);
        log(`Level: ${shield.system.level?.value}`);
        log(`HP: ${shield.system.hp?.max}/${shield.system.hp?.max}`);
        log(`Hardness: ${shield.system.hardness}`);
        log(`Potency Rune: +${shield.system.potencyRune?.value || 'none'}`);
        
        logSection('TEST COMPLETE');
        
        // Generate chat message with results
        const hasErrors = results.some(r => r.isError);
        const chatContent = `
            <h2 style="border-bottom: 2px solid #444; padding-bottom: 5px;">
                Everything Shields Test Results
            </h2>
            <div style="font-family: monospace; font-size: 12px;">
                ${results.map(r => `
                    <div style="color: ${r.isError ? '#ff6b6b' : '#51cf66'}; margin: 2px 0;">
                        ${r.message}
                    </div>
                `).join('')}
            </div>
            <p style="margin-top: 10px; font-weight: bold; color: ${hasErrors ? '#ff6b6b' : '#51cf66'};">
                ${hasErrors ? '✗ Some tests failed' : '✓ All tests passed'}
            </p>
        `;
        
        ChatMessage.create({
            user: game.user.id,
            content: chatContent,
            whisper: [game.user.id]
        });
        
        ui.notifications.info('Test complete - check console and chat for results');
        
    } catch (error) {
        console.error('Test failed:', error);
        log(`<p style="color: #ff6b6b;"><strong>ERROR:</strong> ${error.message}</p>`, true);
        
        ChatMessage.create({
            user: game.user.id,
            content: `<h2>Everything Shields Test - ERROR</h2><p style="color: #ff6b6b;">${error.message}</p>`,
            whisper: [game.user.id]
        });
        
        ui.notifications.error(`Test failed: ${error.message}`);
    }
})();
