import * as gmailService from '../services/gmailService';
import { sleep } from './utils';

export async function getAllMessageIdsFromSender(accessToken, domain) {
    const query = `from:${domain}`;
    let nextPageToken = undefined;
    let allMessageIds = [];
    do {
        const response = await gmailService.listMessages(accessToken, { q: query, maxResults: 100, pageToken: nextPageToken });
        if (response.messages && response.messages.length > 0) {
            allMessageIds.push(...response.messages.map(m => m.id));
        }
        nextPageToken = response.nextPageToken;
    } while (nextPageToken);
    return allMessageIds;
}

export async function trashMessagesBatch(accessToken, messageIds, setActionMessage, setIsBatchProcessing) {
    setIsBatchProcessing(true);
    try {
        setActionMessage(`Trashing ${messageIds.length} emails...`);
        const batchSize = 10;
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < messageIds.length; i += batchSize) {
            const batch = messageIds.slice(i, i + batchSize);
            try {
                const results = await Promise.allSettled(batch.map(id => gmailService.trashMessage(accessToken, id)));
                
                // Count successes and failures
                results.forEach(result => {
                    if (result.status === 'fulfilled') {
                        successCount++;
                    } else {
                        errorCount++;
                        console.error('Failed to trash message:', result.reason);
                    }
                });
                
                setActionMessage(`Trashed ${successCount} of ${messageIds.length} emails... (${errorCount} failed)`);
                await sleep(500);
            } catch (batchError) {
                console.error('Batch deletion error:', batchError);
                errorCount += batch.length;
            }
        }
        
        if (errorCount === 0) {
            setActionMessage(`Successfully trashed all ${messageIds.length} emails.`);
        } else {
            setActionMessage(`Trashed ${successCount} emails. ${errorCount} emails failed to delete.`);
        }
    } catch (error) {
        console.error('Trash operation failed:', error);
        setActionMessage(`Failed to trash emails. Error: ${error.message}`);
    } finally {
        setIsBatchProcessing(false);
    }
}

export async function createUnsubscribeFilter(accessToken, domain, setActionMessage) {
    try {
        setActionMessage(`Creating filter for emails from ${domain}...`);
        
        // Define filter criteria and action
        const filterCriteria = {
            criteria: {
                from: domain
            },
            action: {
                addLabelIds: ['TRASH'],
                removeLabelIds: ['INBOX']
            }
        };

        // Create the filter
        await gmailService.createFilter(accessToken, filterCriteria);
        setActionMessage(`Successfully created filter for ${domain}. Future emails will be automatically moved to trash.`);
        
        return true;
    } catch (error) {
        console.error('Filter creation failed:', error);
        setActionMessage(`Failed to create filter: ${error.message}`);
        return false;
    }
}

/**
 * Creates a filter to automatically trash future emails from a domain
 * and optionally trashes existing emails
 */
export async function handleUnsubscribe(accessToken, domain, setActionMessage, setIsBatchProcessing) {
    setIsBatchProcessing(true);
    try {
        setActionMessage(`Processing unsubscribe for ${domain}...`);

        // 1. Create filter for future emails
        const filterData = {
            criteria: {
                from: domain
            },
            action: {
                addLabelIds: ['TRASH'],
                removeLabelIds: ['INBOX']
            }
        };

        await gmailService.createFilter(accessToken, filterData);
        setActionMessage(`Created filter for ${domain}`);

        // 2. Get existing messages from this sender
        const messageIds = await getAllMessageIdsFromSender(accessToken, domain);
        
        if (messageIds.length > 0) {
            // 3. Move existing messages to trash
            await trashMessagesBatch(accessToken, messageIds, setActionMessage, setIsBatchProcessing);
        }

        setActionMessage(`Successfully unsubscribed from ${domain}. Future emails will be moved to trash automatically.`);
        return true;
    } catch (error) {
        console.error('Unsubscribe operation failed:', error);
        setActionMessage(`Failed to unsubscribe from ${domain}: ${error.message}`);
        return false;
    } finally {
        setIsBatchProcessing(false);
    }
}