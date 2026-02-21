// Everything Shields - Console Test Script
// Copy and paste this into Foundry's browser console (F12) to test the module

(async () => {
    console.log('=== Everything Shields Test Script ===');
    
    // Get the first actor
    const actor = game.actors.contents[0];
    if (!actor) {
        console.error('No actors found in the world');
        return;
    }
    console.log('Testing with actor:', actor.name);
    
    // Find or create a test Hoplon
    let hoplon = actor.items.find(i => i.name === 'Hoplon' && i.type === 'armor');
    if (!hoplon) {
        console.log('No Hoplon found, looking for any shield...');
        hoplon = actor.items.find(i => i.type === 'armor' && i.system?.category === 'shield');
    }
    
    if (!hoplon) {
        console.error('No shield found in actor inventory');
        return;
    }
    
    console.log('Testing with shield:', hoplon.name);
    console.log('Shield data:', {
        id: hoplon.id,
        name: hoplon.name,
        price: hoplon.system.price,
        level: hoplon.system.level,
        hp: hoplon.system.hp,
        hardness: hoplon.system.hardness,
        flags: hoplon.flags?.['everything-shields']
    });
    
    // Test 1: Check if base values are preserved
    console.log('\n=== Test 1: Preserve Initial Values ===');
    if (hoplon.flags?.['everything-shields']?.hitPoints) {
        console.log('✓ Base values already preserved:', hoplon.flags['everything-shields']);
    } else {
        console.log('Base values NOT preserved yet - they will be when you apply a rune');
    }
    
    // Test 2: Check if potency rune is applied
    console.log('\n=== Test 2: Potency Rune Status ===');
    const potencyRune = hoplon.system.potencyRune?.value;
    if (potencyRune) {
        console.log('✓ Potency rune applied:', potencyRune);
    } else {
        console.log('No potency rune applied yet');
    }
    
    // Test 3: Check parent actor reference
    console.log('\n=== Test 3: Parent Actor Reference ===');
    console.log('Parent ID:', hoplon.parent?.id);
    console.log('Actor ID:', hoplon.actor?.id);
    console.log('Actor from parent:', hoplon.parent?.name);
    
    // Test 4: Simulate price calculation
    console.log('\n=== Test 4: Price Calculation Simulation ===');
    const basePrice = hoplon.flags?.['everything-shields']?.price || hoplon.system.price?.value || 0;
    const potencyPrice = potencyRune ? (potencyRune === '1' ? 35 : potencyRune === '2' ? 935 : 8935) : 0;
    const calculatedPrice = basePrice + potencyPrice;
    console.log('Base price from flags:', basePrice);
    console.log('Current shield price:', hoplon.system.price?.value);
    console.log('Potency rune price:', potencyPrice);
    console.log('Expected total:', calculatedPrice);
    console.log('Actual total:', hoplon.system.price?.value);
    console.log('Match:', calculatedPrice === hoplon.system.price?.value ? '✓' : '✗');
    
    // Test 5: Check description buttons
    console.log('\n=== Test 5: Description Buttons ===');
    const description = hoplon.system.description?.value || '';
    const hasButtons = description.includes('everything-shields-button');
    console.log('Has remove buttons:', hasButtons ? '✓' : '✗');
    if (hasButtons) {
        const buttonMatch = description.match(/data-shield-parent-id="([^"]+)"/);
        if (buttonMatch) {
            console.log('Button parent ID:', buttonMatch[1]);
            console.log('Actual parent ID:', hoplon.parent?.id);
            console.log('IDs match:', buttonMatch[1] === hoplon.parent?.id ? '✓' : '✗');
        }
    }
    
    console.log('\n=== Test Complete ===');
    console.log('If you see any ✗ marks, there are issues to fix.');
})();
