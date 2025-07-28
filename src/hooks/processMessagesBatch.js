import { normalizeDomain } from '../utils/gmailUtils';
import * as gmailService from '../services/gmailService';
import { sleep } from './utils';

export async function processMessagesBatch(accessToken, messageIds) {
    const senderCounts = {};
    if (!accessToken || messageIds.length === 0) return senderCounts;
    const batchSize = 10;
    for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);
        const promises = batch.map(id =>
            gmailService.getMessage(accessToken, id, { format: 'metadata', metadataHeaders: ['From'] })
        );
        const results = await Promise.allSettled(promises);
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                const fromHeader = result.value.payload?.headers?.find(h => h.name.toLowerCase() === 'from')?.value;
                const domain = normalizeDomain(fromHeader);
                if (domain) {
                    senderCounts[domain] = (senderCounts[domain] || 0) + 1;
                }
            }
        });
        await sleep(300);
    }
    return senderCounts;
}