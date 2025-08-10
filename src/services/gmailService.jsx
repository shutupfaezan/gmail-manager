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

/**
 * Creates a new filter.
 * @param {string} accessToken - The Google API access token.
 * @param {object} filter - The filter object to create.
 * @param {object} filter.criteria - Criteria for the filter (e.g., {from: "user@example.com"}).
 * @param {object} filter.action - Action to perform (e.g., {addLabelIds: ["TRASH"], removeLabelIds: ["INBOX"]}).
 * @returns {Promise<object>} A promise that resolves to the API response (the created filter).
 */
export async function createFilter(accessToken, filter) {
    const url = `${GMAIL_API_BASE_URL}/settings/filters`;
    const body = JSON.stringify(filter);

    return authenticatedFetch(accessToken, url, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Gets profile information for email addresses using Gravatar.
 * @param {string[]} emailAddresses - Array of email addresses to get profile info for.
 * @returns {Promise<object>} A promise that resolves to profile information.
 */
export async function getProfiles(emailAddresses) {
    const profiles = {};
    
    for (const email of emailAddresses) {
        try {
            // Generate Gravatar URL
            const emailHash = await generateMD5(email.toLowerCase().trim());
            const gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}?d=mp&s=200`;
            
            profiles[email] = {
                name: email.split('@')[0],
                photoUrl: gravatarUrl,
                email: email
            };
        } catch (error) {
            console.warn(`Failed to get profile for ${email}:`, error);
            profiles[email] = {
                name: email.split('@')[0],
                photoUrl: null,
                email: email
            };
        }
    }
    
    return profiles;
}

/**
 * Generates MD5 hash for Gravatar.
 * @param {string} str - String to hash.
 * @returns {Promise<string>} MD5 hash.
 */
async function generateMD5(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('MD5', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extracts email addresses from message headers.
 * @param {string} accessToken - The Google API access token.
 * @param {string[]} messageIds - Array of message IDs to extract emails from.
 * @returns {Promise<Set<string>>} A promise that resolves to a set of unique email addresses.
 */
export async function extractEmailAddresses(accessToken, messageIds) {
    const emailAddresses = new Set();
    const batchSize = 10;
    
    for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);
        const promises = batch.map(id =>
            getMessage(accessToken, id, { format: 'metadata', metadataHeaders: ['From'] })
        );
        
        const results = await Promise.allSettled(promises);
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                const fromHeader = result.value.payload?.headers?.find(h => h.name.toLowerCase() === 'from')?.value;
                if (fromHeader) {
                    // Extract email from "Name <email@domain.com>" format
                    const emailMatch = fromHeader.match(/<(.+?)>/) || fromHeader.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                    if (emailMatch) {
                        emailAddresses.add(emailMatch[1]);
                    }
                }
            }
        });
        
        // Rate limiting
        if (i + batchSize < messageIds.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    return emailAddresses;
}