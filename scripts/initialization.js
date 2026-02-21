export function initializeEverythingShields() {
    game.pf2e.EverythingShields = {
        RemovePropertyRune: removePropertyRune,
        RemoveHardenedRune: removeHardenedRune,
        RemovePotencyRune: removePotencyRune
    }

    moduleSettings = new ModuleSettings();

    registerClickHandler();
}

function registerClickHandler() {
    $("body").click(event => {
        if (!event.target.classList.contains("everything-shields-button")) {
            return;
        }

        if (event.target.classList.contains("everything-shields-remove-property-rune")) {
            const shieldParentId = event.target.dataset.shieldParentId;
            const shieldId = event.target.dataset.shieldId;
            const runeName = event.target.dataset.shieldPropertyRuneName;
            removePropertyRune(shieldParentId, shieldId, runeName);

            return;
        }

        if (event.target.classList.contains("everything-shields-remove-hardened-rune")) {
            const shieldParentId = event.target.dataset.shieldParentId;
            const shieldId = event.target.dataset.shieldId;
            removeHardenedRune(shieldParentId, shieldId);

            return;
        }

        if (event.target.classList.contains("everything-shields-remove-potency-rune")) {
            const shieldParentId = event.target.dataset.shieldParentId;
            const shieldId = event.target.dataset.shieldId;
            removePotencyRune(shieldParentId, shieldId);
            
            return;
        }
    });
}