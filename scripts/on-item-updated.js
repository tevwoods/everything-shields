import { itemsBeingUpdated } from "./data/items-being-updated";
import { getPreciousMaterial } from "./item-functions";

export async function onItemUpdated(updatingItem, newValues, nothing, initiatorUserId) {
    if (game.userId !== initiatorUserId) {
        return;
    }

    if (moduleSettings.disableAllAutomations) {
        return;
    }

    if (isItemBeingProgrammaticallyUpdated(updatingItem)) {
        return; //we're in the process of updating this item programmatically
    }

    if (isItemNotUpdated(updatingItem, newValues)) {
        return;
    }

    await updateShield(updatingItem);

    if (getPreciousMaterial(updatingItem)) {
        ui.notifications.info(`Everything Shields: The ${updatingItem.name} has had its stats {HP, Hardness, Price, Level, and Bulk} updated to reflect its precious material components.`);
    }
}

function isItemBeingProgrammaticallyUpdated(updatingItem) {
    if (itemsBeingUpdated[updatingItem._id]) {
        delete itemsBeingUpdated[updatingItem._id];

        return true;
    }
}

function isItemNotUpdated(updatingItem, newValues) {
    return !updatingItem || !updatingItem.type || !updatingItem.type === "shield" || !newValues || !newValues.system || !newValues.system.material || (!newValues.system.material.type && !newValues.system.material.grade);
}
