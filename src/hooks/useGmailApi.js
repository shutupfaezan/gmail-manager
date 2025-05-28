import { useCallback } from 'react';
import { listMessages as serviceListMessages, getMessage as serviceGetMessage, trashMessage as serviceTrashMessage, batchModifyMessages as serviceBatchModifyMessages } from '../services/gmailService';

export function useGmailApi(accessToken) {
    // This internal helper is no longer needed as the service functions handle auth and error
    // const callGmailApi = useCallback(async (url, errorMessagePrefix) => {
    //     if (!accessToken) {
    //         // Or handle this more gracefully, e.g., by returning a specific error object
    //         throw new Error("Access token is not available for API call.");
    //     }
    //     const response = await fetch(url, {
    //         headers: { 'Authorization': `Bearer ${accessToken}` }
    //     });

    //     if (!response.ok) {
    //         const errData = await response.json().catch(() => ({ error: { message: 'Unknown API error structure' } }));
    //         console.error(`${errorMessagePrefix} - API Error:`, response.status, errData);
    //         throw new Error(`${errorMessagePrefix}: ${response.status} ${errData.error?.message || 'Unknown API error'}`);
    //     }
    //     return response.json();
    // }, [accessToken]);

    const listMessages = useCallback(async (query, pageToken, maxResults = 500, fields = null) => {
        if (!accessToken) {
            throw new Error("Access token is not available for API call.");
        }
        try {
            // Use the service function
            return await serviceListMessages(accessToken, { q: query, pageToken, maxResults, fields });
        } catch (e) {
            console.error("Error in useGmailApi.listMessages:", e);
            throw e; // Re-throw to be caught by the hook consumer
        }
    }, [accessToken, serviceListMessages]); // Depend on accessToken and the service function

    const getMessageDetails = useCallback(async (messageId, metadataHeaders = ['From', 'Date', 'Subject']) => {
        if (!accessToken) {
            throw new Error("Access token is not available for API call.");
        }
        try {
            // Use the service function
            return await serviceGetMessage(accessToken, messageId, { format: 'metadata', metadataHeaders });
        } catch (e) {
            console.error(`Error in useGmailApi.getMessageDetails for ${messageId}:`, e);
            throw e;
        }
    }, [accessToken, serviceGetMessage]); // Depend on accessToken and the service function

    const trashMessage = useCallback(async (messageId) => {
        if (!accessToken) {
            throw new Error("Access token is not available for API call.");
        }
        try {
            // Use the service function
            return await serviceTrashMessage(accessToken, messageId);
        } catch (e) {
            console.error(`Error in useGmailApi.trashMessage for ${messageId}:`, e);
            throw e;
        }
    }, [accessToken, serviceTrashMessage]); // Depend on accessToken and the service function

    const batchTrashMessages = useCallback(async (messageIds) => {
        if (!accessToken) {
            throw new Error("Access token is not available for API call.");
        }
        try {
            // To trash, we add 'TRASH' label. Gmail usually handles removing from 'INBOX'.
            // If needed, we could also explicitly remove 'INBOX' and 'UNREAD' labels.
            return await serviceBatchModifyMessages(accessToken, messageIds, { addLabelIds: ['TRASH'] });
        } catch (e) {
            console.error(`Error in useGmailApi.batchTrashMessages:`, e);
            throw e;
        }
    }, [accessToken, serviceBatchModifyMessages]);

    return {
        listMessages,
        getMessageDetails,
        trashMessage, // Expose the new function
        batchTrashMessages,
    };
}