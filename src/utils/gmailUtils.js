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