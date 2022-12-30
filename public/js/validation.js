/**
 * Validate the given URL to be a HTTP or HTTPS URL.
 * @param {URL} string the URL to validate
 * @returns true in case the URL is valid, else false
 */
function isValidHttpUrl(string) {
    let url;
    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
}

function isValidFilename(filename) {
    return /^[\w,\s-]+$/.test(filename);
}