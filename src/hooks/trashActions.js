import * as gmailService from '../services/gmailService';
import { sleep } from './utils';

export async function trashAllFromSender(accessToken, domain, setActionMessage, setIsBatchProcessing) {
    setIsBatchProcessing(true);
    setActionMessage(`Finding all emails from ${domain}...`);
    try {
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

        setActionMessage(`Trashing ${allMessageIds.length} emails from ${domain}...`);
        const batchSize = 10;
        for (let i = 0; i < allMessageIds.length; i += batchSize) {
            const batch = allMessageIds.slice(i, i + batchSize);
            await Promise.allSettled(batch.map(id => gmailService.trashMessage(accessToken, id)));
            setActionMessage(`Trashed ${Math.min(i + batchSize, allMessageIds.length)} of ${allMessageIds.length} emails...`);
            await sleep(500);
        }
        setActionMessage(`All emails from ${domain} have been trashed.`);
    } catch (error) {
        setActionMessage(`Failed to trash all from ${domain}. Error: ${error.message}`);
    } finally {
        setIsBatchProcessing(false);
    }
}