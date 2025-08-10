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