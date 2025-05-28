// Helper function to add delay (for API pacing)
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to normalize domain (basic version)
export function normalizeDomain(emailAddressHeader) {
    if (!emailAddressHeader) return 'unknown_sender';
    // Regex to find an email address; handles "Display Name <email@domain.com>"
    const emailMatch = emailAddressHeader.match(/<([^>]+@[^>]+)>/);
    let emailAddress = emailAddressHeader;
    if (emailMatch && emailMatch[1]) {
        emailAddress = emailMatch[1];
    }

    const parts = emailAddress.split('@');
    if (parts.length < 2) return 'unknown_sender'; // Not a valid email format

    const domain = parts[parts.length - 1].toLowerCase();

    const domainParts = domain.split('.');
    if (domainParts.length > 2) {
        if (['co', 'com', 'org', 'net', 'gov', 'edu'].includes(domainParts[domainParts.length - 2]) && domainParts.length > 2) {
            return domainParts.slice(-3).join('.');
        }
        return domainParts.slice(-2).join('.');
    }
    return domain;
}

// Helper function to get ISO week from a Date object
export function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Extracts the first HTTP/HTTPS URL from a List-Unsubscribe header value.
 * List-Unsubscribe can contain multiple URIs, often <mailto:...> and <http(s)://...>.
 * This function prioritizes http(s) links.
 * @param {string} headerValue - The value of the List-Unsubscribe header.
 * @returns {string|null} The extracted URL or null if not found.
 */
export function extractHttpUnsubscribeLink(headerValue) {
    if (!headerValue) return null;
    // Regex to find URLs within angle brackets <...>
    const matches = headerValue.match(/<([^>]+)>/g);
    if (!matches) return null;

    for (const match of matches) {
        const url = match.substring(1, match.length - 1); // Remove < and >
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
    }
    return null;
}

/**
 * Extracts the sender's email from a message's 'From' header.
 * @param {string} fromHeader - The 'From' header string (e.g., "Sender Name <sender@example.com>").
 * @returns {string|null} The sender's email address or null if not found.
 */
export function extractSenderEmail(fromHeader) {
    if (!fromHeader) return null;
    const match = fromHeader.match(/<([^>]+)>/);
    return match ? match[1] : fromHeader; // Fallback to the whole string if no <...> found
}