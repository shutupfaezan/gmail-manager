import { useCallback } from 'react';
import { listMessages as serviceListMessages, getMessage as serviceGetMessage, trashMessage as serviceTrashMessage, batchModifyMessages as serviceBatchModifyMessages, createFilter as serviceCreateFilter } from '../services/gmailService';

export function useGmailApi(accessToken) {
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

    const getMessageDetails = useCallback(async (messageId, metadataHeaders = ['From', 'Date', 'Subject', 'List-Unsubscribe']) => {
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

    const createFilter = useCallback(async (criteria, action) => {
        if (!accessToken) {
            throw new Error("Access token is not available for API call.");
        }
        try {
            return await serviceCreateFilter(accessToken, { criteria, action });
        } catch (e) {
            console.error(`Error in useGmailApi.createFilter:`, e);
            throw e;
        }
    }, [accessToken, serviceCreateFilter]);


    return {
        listMessages,
        getMessageDetails,
        trashMessage, // Expose the new function
        batchTrashMessages,
        createFilter, // Expose the new function
    };
}