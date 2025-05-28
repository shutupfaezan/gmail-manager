// src/services/gmailService.js

const GMAIL_API_BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';

// Helper function for making authenticated API calls
async function authenticatedFetch(accessToken, url, options = {}) {
    if (!accessToken) {
        throw new Error("Access token is not available for API call.");
    }
    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText || 'Unknown API error structure' } }));
        console.error('API Error:', response.status, errorData);
        throw new Error(`API request failed: ${response.status} ${errorData.error?.message || response.statusText}`);
    }
    // Handle 204 No Content specifically, as .json() would fail
    if (response.status === 204) {
        return Promise.resolve(); // Or return a specific success object if needed
    }
    return response.json();
}

// /**
//  * Lists messages in the user's mailbox.
//  * @param {string} accessToken - The Google API access token.
//  * @param {object} options - Optional parameters.
//  * @param {number} [options.maxResults=100] - Maximum number of messages to return.
//  * @param {string} [options.pageToken] - Page token for fetching a specific page of results.
//  * @param {string} [options.q] - Query string to filter messages (e.g., 'is:unread').
//  * @returns {Promise<object>} A promise that resolves to the API response (list of message IDs).
//  */
export async function listMessages(accessToken, { maxResults = 20, pageToken, q, fields } = {}) {
    const url = new URL(`${GMAIL_API_BASE_URL}/messages`);
    url.searchParams.append('maxResults', maxResults);
    if (pageToken) url.searchParams.append('pageToken', pageToken);
    if (q) url.searchParams.append('q', q);
    if (fields) url.searchParams.append('fields', fields);

    return authenticatedFetch(accessToken, url.toString(), {
        method: 'GET',
    });
}

// /**
//  * Gets the specified message.
//  * @param {string} accessToken - The Google API access token.
//  * @param {string} messageId - The ID of the message to retrieve.
//  * @param {object} options - Optional parameters.
//  * @param {string} [options.format='metadata'] - The format to return the message in ('full', 'minimal', 'raw', 'metadata').
//  * @param {string[]} [options.metadataHeaders] - When format is 'metadata', specific headers to include. e.g., ['From', 'Subject'].
//  * @returns {Promise<object>} A promise that resolves to the API response (message details).
//  */
export async function getMessage(accessToken, messageId, { format = 'metadata', metadataHeaders } = {}) {
    const url = new URL(`${GMAIL_API_BASE_URL}/messages/${messageId}`);
    url.searchParams.append('format', format);
    if (format === 'metadata' && metadataHeaders && metadataHeaders.length > 0) {
        metadataHeaders.forEach(header => url.searchParams.append('metadataHeaders', header));
    }

    return authenticatedFetch(accessToken, url.toString(), {
        method: 'GET',
    });
}

// /**
//  * Moves the specified message to the trash.
//  * @param {string} accessToken - The Google API access token.
//  * @param {string} messageId - The ID of the message to trash.
//  * @returns {Promise<object>} A promise that resolves to the API response (status of the trash operation).
//  */
export async function trashMessage(accessToken, messageId) {
    const url = `${GMAIL_API_BASE_URL}/messages/${messageId}/trash`;
    return authenticatedFetch(accessToken, url, { method: 'POST' });
}

// /**
//  * Modifies the labels on a batch of messages.
//  * @param {string} accessToken - The Google API access token.
//  * @param {string[]} messageIds - An array of message IDs to modify.
//  * @param {string[]} [addLabelIds=[]] - Array of label IDs to add to the messages.
//  * @param {string[]} [removeLabelIds=[]] - Array of label IDs to remove from the messages.
//  * @returns {Promise<void>} A promise that resolves when the operation is complete (Gmail API returns 204 No Content on success).
//  */
export async function batchModifyMessages(accessToken, messageIds, { addLabelIds = [], removeLabelIds = [] } = {}) {
    const url = `${GMAIL_API_BASE_URL}/messages/batchModify`;
    const body = JSON.stringify({
        ids: messageIds,
        addLabelIds: addLabelIds,
        removeLabelIds: removeLabelIds,
    });
    // For batchModify, a 204 No Content is success, so authenticatedFetch needs to handle it
    // or we handle it here. Let's assume authenticatedFetch will throw for non-2xx.
    return authenticatedFetch(accessToken, url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
}
// /**
//  * Extracts the sender's email from a message's 'From' header.
//  * @param {string} fromHeader - The 'From' header string (e.g., "Sender Name <sender@example.com>").
//  * @returns {string|null} The sender's email address or null if not found.
//  */

export function extractSenderEmail(fromHeader) {
    if (!fromHeader) return null;
    const match = fromHeader.match(/<([^>]+)>/);
    return match ? match[1] : fromHeader; // Fallback to the whole string if no <...> found
}