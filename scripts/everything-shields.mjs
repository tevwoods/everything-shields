import { initializeEverythingShields } from "./initialization";
import { onItemDroppedOnActor } from "./on-item-dropped-on-actor";
import { onItemUpdated } from "./on-item-updated";
import { onBeforeItemCreated } from "./on-before-item-created";

Hooks.on('init', () => initializeEverythingShields());

Hooks.on('updateItem', async (updatingItem, newValues, nothing, initiatorUserId) => onItemUpdated(updatingItem, newValues, nothing, initiatorUserId));

Hooks.on('dropActorSheetData', async (targetActor, targetSheet, dragSource) => onItemDroppedOnActor(targetActor, targetSheet, dragSource));

Hooks.on('preCreateItem', (createdItem, otherItem, options, initiatorUserId) => onBeforeItemCreated(createdItem, otherItem, options, initiatorUserId));