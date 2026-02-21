export function getPreciousMaterial(item) {
    if (!item.system.material || !item.system.material.type) {
        return;
    }

    const material = PreciousMaterials[item.system.material.type];

    if (!material) {
        return;
    }

    return material[item.system.material.type];
}

export function getAllUpdateableValuesFromShield(shield) {
    return {
        [updatePropertyNames.hardness]: shield.system.hardness,
        [updatePropertyNames.hitPointsMax]: shield.system.hp.max,
        [updatePropertyNames.hitPointsValue]: shield.system.hp.value,
        [updatePropertyNames.brokenThreshold]: shield.system.hp.brokenThreshold,
        [updatePropertyNames.description]: shield.system.description.value,
        [updatePropertyNames.price]: shield.system.price.value,
        [updatePropertyNames.level]: shield.system.level.value,
        [updatePropertyNames.name]: shield.name,
        [updatePropertyNames.bulk]: shield.system.bulk.value,
        [updatePropertyNames.traitsArray]: shield.system.traits.value,
        [updatePropertyNames.ruleElements]: shield.system.rules
    }
}

export function isShieldPreparedForUse(shield) {
    return shield.flags && shield.flags['everything-shields'];
}

export function prepareShieldForUse(shield) {
    if (shield.flags && shield.flags['everything-shields']) {
        //we've already tagged this
        return;
    }

    if (!shield.flags) {
        shield.flags = {};
    }

    shieldValues = {
        hardness: shield.system.hardness,
        hitPoints: shield.hitPoints.max,
        name: shield.name,
        bulk: shield.bulk,
        price: shield.price.value,
        level: shield.level,
        description: shield.description
    };

    shield.flags['everything-shields'] = shieldValues;

    return true;


}

export function getShieldPreparationUdpates(shield) {
    const shieldValues = shield.flags['everything-shields'];

    return {
        'flags.everything-shields.hardness': shieldValues.hardness,
        'flags.everything-shields.hitPoints': shieldValues.hitPoints,
        'flags.everything-shields.name': shieldValues.name,
        'flags.everything-shields.bulk': shieldValues.bulk,
        'flags.everything-shields.price': shieldValues.price,
        'flags.everything-shields.level': shieldValues.level,
        'flags.everything-shields.description': shieldValues.description
    };
}

export function preserveInitialValues(shield) {
    if (shield.flags && shield.flags['everything-shields']) {
        //we've already tagged this
        return;
    }

    if (!shield.flags) {
        shield.flags = {};
    }

    if (!shield.flags['everything-shields']) {
        shield.flags['everything-shields'] = {};
    }

    const everythingShieldsProperties = getEverythingShieldsProperties(shield);

    everythingShieldsProperties.hardness = shield.system.hardness;
    everythingShieldsProperties.hitPoints = shield.hitPoints.max;
    everythingShieldsProperties.name = shield.name;
    everythingShieldsProperties.bulk = shield.bulk;
    everythingShieldsProperties.price = shield.price.value;
    everythingShieldsProperties.level = shield.level;
    everythingShieldsProperties.description = shield.description;

    return {
        'flags.everything-shields.hitPoints': shield.hitPoints.max,
        'flags.everything-shields.hardness': shield.system.hardness,
        'flags.everything-shields.name': shield.name,
        'flags.everything-shields.bulk': shield.bulk,
        'flags.everything-shields.price': shield.price.value,
        'flags.everything-shields.level': shield.level,
        'flags.everything-shields.description': shield.description
    };
}

export function getEverythingShieldsProperties(shield) {
    if (!shield.flags || ! shield.flags['everything-shields']) {
        return;
    }

    return shield.flags['everything-shields'];
}