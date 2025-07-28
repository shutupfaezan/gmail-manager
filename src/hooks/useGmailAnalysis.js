import { useState, useEffect, useCallback, useRef } from 'react';
import * as gmailService from '../services/gmailService';
import { normalizeDomain } from '../utils/gmailUtils';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const useGmailAnalysis = (accessToken) => {
    // --- State Management ---
    const [stage1SenderData, setStage1SenderData] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState('');

    const [selectedSenderForLifetime, setSelectedSenderForLifetime] = useState(null);
    const [lifetimeEmailsDisplay, setLifetimeEmailsDisplay] = useState([]);
    const [isFetchingLifetime, setIsFetchingLifetime] = useState(false);
    const [currentStage, setCurrentStage] = useState(0);
    const [deletingEmailIds, setDeletingEmailIds] = useState(new Set());
    const [actionMessage, setActionMessage] = useState('');
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [unsubscribeState, setUnsubscribeState] = useState({ isLoading: false, message: '', link: null, senderDomain: null });
    const [filterCreationState, setFilterCreationState] = useState({ isLoading: false, message: '', senderIdentifier: null });

    const stopProcessingRef = useRef(false);

    // --- Core Logic ---

    // Throttle batch size to 10-20 to avoid rate limits
    const processMessagesBatch = useCallback(async (messageIds) => {
        const senderCounts = {};
        if (!accessToken || messageIds.length === 0) return senderCounts;

        // Process in small sub-batches to avoid rate limits
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
            // Throttle between sub-batches
            await sleep(300);
        }
        return senderCounts;
    }, [accessToken]);

    const performStage1Analysis = useCallback(async () => {
        setIsLoading(true);
        setIsBackgroundLoading(false);
        setError(null);
        setStage1SenderData({});
        setProgress('Starting analysis...');
        setCurrentStage(1);
        stopProcessingRef.current = false;

        let totalProcessedMessages = 0;
        let currentSenderDataAccumulator = {};

        try {
            setProgress('Analyzing recent emails (last 7 days)...');
            let initialResponse = await gmailService.listMessages(accessToken, { q: 'newer_than:7d', maxResults: 100 });
            if (initialResponse.messages && initialResponse.messages.length > 0) {
                const messageIds = initialResponse.messages.map(m => m.id);
                const newCounts = await processMessagesBatch(messageIds);

                // Merge newCounts into accumulator
                Object.entries(newCounts).forEach(([domain, count]) => {
                    // Store as { total: count } for each domain
                    currentSenderDataAccumulator[domain] = { total: (currentSenderDataAccumulator[domain]?.total || 0) + count };
                });
                setStage1SenderData({ ...currentSenderDataAccumulator });
                totalProcessedMessages += messageIds.length;
                setProgress(`Found ${Object.keys(currentSenderDataAccumulator).length} senders in ${totalProcessedMessages} recent emails.`);
            } else {
                setProgress('No recent emails found in the last 7 days.');
            }

            setIsLoading(false);
            setIsBackgroundLoading(true);
            setCurrentStage(2);
            setProgress('Scanning older emails in the background...');

            let nextPageToken = initialResponse.nextPageToken;

            if (!nextPageToken) {
                setProgress(`Analysis complete. Scanned a total of ${totalProcessedMessages} emails.`);
                setIsBackgroundLoading(false);
                setCurrentStage(0);
                return;
            }

            do {
                if (stopProcessingRef.current) {
                    setProgress('Background scanning stopped.');
                    break;
                }

                const response = await gmailService.listMessages(accessToken, { maxResults: 100, pageToken: nextPageToken });
                if (!response.messages || response.messages.length === 0) {
                    setProgress('No more emails to scan.');
                    break;
                }

                const messageIds = response.messages.map(m => m.id);
                const newCounts = await processMessagesBatch(messageIds);

                // Merge newCounts into accumulator
                Object.entries(newCounts).forEach(([domain, count]) => {
                    currentSenderDataAccumulator[domain] = { total: (currentSenderDataAccumulator[domain]?.total || 0) + count };
                });
                setStage1SenderData({ ...currentSenderDataAccumulator });
                totalProcessedMessages += messageIds.length;
                setProgress(`Scanned ${totalProcessedMessages} total emails...`);

                await sleep(500); // Throttle between page batches

                nextPageToken = response.nextPageToken;
            } while (nextPageToken && !stopProcessingRef.current);

            setProgress(`Analysis complete. Scanned a total of ${totalProcessedMessages} emails.`);
        } catch (err) {
            setError(err.message || 'An error occurred during analysis.');
            setProgress('');
        } finally {
            setIsLoading(false);
            setIsBackgroundLoading(false);
            setCurrentStage(0);
        }
    }, [accessToken, processMessagesBatch]);

    useEffect(() => {
        if (accessToken) {
            performStage1Analysis();
        }
        return () => {
            stopProcessingRef.current = true;
        };
    }, [accessToken, performStage1Analysis]);

    // --- Placeholder Handlers for Other Features ---
    const handleSenderSelectionForLifetime = useCallback((domain) => {
        setSelectedSenderForLifetime(domain);
        setActionMessage(`Feature not implemented: Analyze Lifetime Emails for ${domain}`);
        console.log("handleSenderSelectionForLifetime called for", domain);
    }, []);

    const handleStopLifetimeFetch = useCallback(() => {
        setActionMessage("Feature not implemented: Stop Lifetime Fetch");
        console.log("handleStopLifetimeFetch called");
    }, []);

    const handleTrashEmail = useCallback(async (messageId, subject) => {
        setDeletingEmailIds(prev => new Set(prev).add(messageId));
        setActionMessage(`Attempting to trash email: "${subject}"...`);
        console.log("handleTrashEmail called for", messageId, subject);
        try {
            await gmailService.trashMessage(accessToken, messageId);
            setActionMessage(`Successfully trashed email: "${subject}".`);
            console.log("Successfully trashed email:", messageId);
        } catch (error) {
            setActionMessage(`Failed to trash email: "${subject}". Error: ${error.message}`);
            console.error("Failed to trash email:", messageId, error);
        } finally {
            setDeletingEmailIds(prev => {
                const newState = new Set(prev);
                newState.delete(messageId);
                return newState;
            });
        }
    }, [accessToken]);

    const handleTrashAllFromSender = useCallback(async (domain) => {
        setIsBatchProcessing(true);
        setActionMessage(`Finding all emails from ${domain}...`);
        try {
            // Search for all messages from this domain
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
            // Trash in small batches to avoid rate limits
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
            console.error("Failed to trash all from sender:", domain, error);
        } finally {
            setIsBatchProcessing(false);
        }
    }, [accessToken]);

    const handleAttemptUnsubscribe = useCallback(async (domain) => {
        setUnsubscribeState({ isLoading: true, message: `Searching for unsubscribe link for ${domain}...`, link: null, senderDomain: domain });
        console.log("handleAttemptUnsubscribe called for", domain);
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            setUnsubscribeState({ isLoading: false, message: `Unsubscribe search for ${domain} complete (stub).`, link: 'https://example.com/mock-unsubscribe', senderDomain: domain });
            console.log("Unsubscribe search complete for", domain);
        } catch (error) {
            setUnsubscribeState({ isLoading: false, message: `Error searching for unsubscribe for ${domain}: ${error.message}`, link: null, senderDomain: domain });
            console.error("Error searching for unsubscribe for", domain, error);
        }
    }, [accessToken]);

    const openUnsubscribePage = useCallback((link) => {
        if (link) {
            window.open(link, '_blank', 'noopener,noreferrer');
            setActionMessage('Unsubscribe page opened in a new tab.');
            console.log("Unsubscribe page opened:", link);
        } else {
            setActionMessage('No unsubscribe link available to open.');
            console.log("No unsubscribe link available to open.");
        }
    }, []);

    const handleCreateFilterForSender = useCallback(async (domain) => {
        setFilterCreationState({ isLoading: true, message: `Creating filter for ${domain}...`, senderIdentifier: domain });
        console.log("handleCreateFilterForSender called for", domain);
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            setFilterCreationState({ isLoading: false, message: `Filter created for ${domain} (stub).`, senderIdentifier: domain });
            setActionMessage(`Filter for ${domain} created successfully (stub).`);
            console.log("Filter created for", domain);
        } catch (error) {
            setFilterCreationState({ isLoading: false, message: `Failed to create filter for ${domain}: ${error.message}`, senderIdentifier: domain });
            setActionMessage(`Failed to create filter for ${domain}. Error: ${error.message}`);
            console.error("Failed to create filter for", domain, error);
        }
    }, [accessToken]);


    // --- Return Values for the Hook ---
    return {
        stage1SenderData,
        isLoading,
        isBackgroundLoading,
        error,
        progress,
        currentStage,
        performStage1Analysis,
        selectedSenderForLifetime,
        lifetimeEmailsDisplay,
        isFetchingLifetime,
        handleSenderSelectionForLifetime,
        handleStopLifetimeFetch,
        actionMessage,
        deletingEmailIds,
        isBatchProcessing,
        unsubscribeState,
        filterCreationState,
        handleTrashEmail,
        handleTrashAllFromSender,
        handleAttemptUnsubscribe,
        openUnsubscribePage,
        handleCreateFilterForSender,
    };
};
