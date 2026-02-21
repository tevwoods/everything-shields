import { getAllUpdateableValuesFromShield, getShieldPreparationUdpates, isShieldPreparedForUse, prepareShieldForUse } from "./item-functions";

export async function updateShield(shield, rune, otherUpdates) {

    let update = otherUpdates || {};

    let updateableValues = getAllUpdateableValuesFromShield(shield);

    let updatingValues = getAllUpdateValues(shield, update);

    update = { ...update, ...updatingValues };

    // const specificMagicShieldUpdates = await handleSpecificMagicShields(shield);
    
    // update = { ...update, ...specificMagicShieldUpdates };

    const initialValuesUpdate = preserveInitialValues(shield);

    // if (specificMagicShieldUpdates && specificMagicShieldUpdates[everythingShieldsPropertyNames.isSpecificShield] === true) {
    //     const everythingShieldsProperties = getEverythingShieldsProperties(shield);

    //     everythingShieldsProperties.specificShieldHpBonus = specificMagicShieldUpdates[everythingShieldsPropertyNames.specificShieldHpBonus];
    //     everythingShieldsProperties.specificShieldHardnessBonus = specificMagicShieldUpdates[everythingShieldsPropertyNames.specificShieldHardnessBonus];
    //     everythingShieldsProperties.isSpecificShield = true;
    // }
    
    update = { ...update, ...initialValuesUpdate };

    if (!update[updatePropertyNames.hardness]) {
        update[updatePropertyNames.hardness] = shield.system.hardness;
    }
    
    if (hardenedRuneNames[rune]) {
        const hardenedRuneUpdate = applyHardenedRune(shield, rune);

        update = { ...update, ...hardenedRuneUpdate };
    }
    else if (shieldPotencyRuneNames[rune]) {
        const potencyRuneUpdate = applyShieldPotencyRune(shield, rune);

        update = { ...update, ...potencyRuneUpdate };
    }

    //const materialUpdate = applyPreciousMaterialAdjustments(shield);

    //update = { ...update, ...materialUpdate };

    const propertyRunesUpdate = calculatePropertyRunes(shield, update);

    update = { ...update, ...propertyRunesUpdate };

    const namePriceAndLevelUpdate = calculateNamePriceAndLevel(shield, update);

    update = { ...update, ...namePriceAndLevelUpdate };

    const descriptionUpdate = calculateDescription(shield, update);

    update = { ...update, ...descriptionUpdate };

    const traitUpdate = calculateTraits(shield, update);

    update = { ...update, ...traitUpdate };

    updatingItemId = shield._id;

    await runUpdate(shield, update);

    if (update[updatePropertyNames.hitPointsValue]) {
        //when updating the shield's max hp, you can't update the current HP at the same time
        //that means we have to just run it back again.
        //updatingItemId = shield._id;
        await runUpdate(shield, {
            [updatePropertyNames.hitPointsValue]: update[updatePropertyNames.hitPointsMax]
        });
    }

    return true;
}

export async function newUpdateShield(shield, runeToAdd) {
    const updates = {};

    if (!isShieldPreparedForUse(shield)) {
        prepareShieldForUse(shield);

        updates = { ...updates, ...getShieldPreparationUdpates(shield) };
    }

    if (!updates[updatePropertyNames.hardness]) {
        updates[updatePropertyNames.hardness] = shield.system.hardness;
    }
    
    if (hardenedRuneNames[rune]) {
        const hardenedRuneUpdate = applyHardenedRune(shield, rune);

        updates = { ...updates, ...hardenedRuneUpdate };
    }
    else if (shieldPotencyRuneNames[rune]) {
        const potencyRuneUpdate = applyShieldPotencyRune(shield, rune);

        updates = { ...updates, ...potencyRuneUpdate };
    }

    //const materialUpdate = applyPreciousMaterialAdjustments(shield);

    //update = { ...update, ...materialUpdate };

    const propertyRunesUpdate = calculatePropertyRunes(shield, updates);

    updates = { ...updates, ...propertyRunesUpdate };

    const namePriceAndLevelUpdate = calculateNamePriceAndLevel(shield, updates);

    updates = { ...updates, ...namePriceAndLevelUpdate };

    const descriptionUpdate = calculateDescription(shield, updates);

    updates = { ...updates, ...descriptionUpdate };

    const traitUpdate = calculateTraits(shield, updates);

    updates = { ...updates, ...traitUpdate };

    itemsBeingUpdated[shield._id] = 1;

    await runUpdate(shield, updates);

    if (updates[updatePropertyNames.hitPointsValue]) {
        //when updating the shield's max hp, you can't update the current HP at the same time
        //that means we have to just run it back again.
        //updatingItemId = shield._id;
        itemsBeingUpdated[shield._id] = 1;

        await runUpdate(shield, {
            [updatePropertyNames.hitPointsValue]: updates[updatePropertyNames.hitPointsMax]
        });
    }
}