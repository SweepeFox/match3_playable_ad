export function waitForMRAID(callback) {
    if (window.mraid) {
        if (mraid.getState() === "loading") {
            mraid.addEventListener("ready", callback);
        } else {
            callback();
        }
    } else {
        // Fallback if not in MRAID environment
        callback();
    }
}

function openStoreLink(url) {
    if (window.mraid) {
        mraid.open(url);
    } else {
        window.open(url, "_blank");
    }
}