import { useState, useEffect, useCallback, useRef } from 'react';
import { useGmailApi } from './useGmailApi'; // Assuming useGmailApi is in the same hooks folder
import { sleep, normalizeDomain, getISOWeek } from '../utils/gmailUtils'; // Adjust path if utils are elsewhere

const STAGE1_PAGE_SIZE = 500;
const LIFETIME_ID_FETCH_PAGE_SIZE = 50;
const BATCH_TRASH_CHUNK_SIZE = 100; // Gmail API batchModify limit is 1000, but smaller chunks can be safer for UI feedback

export function useGmailAnalysis(accessToken) {
    const [stage1SenderData, setStage1SenderData] = useState({});
    const [selectedSenderForLifetime, setSelectedSenderForLifetime] = useState(null);
    const [lifetimeEmailsDisplay, setLifetimeEmailsDisplay] = useState([]);
    const [isFetchingLifetime, setIsFetchingLifetime] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // For Stage 1 analysis
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState('');
    const [currentStage, setCurrentStage] = useState(0); // 0: idle, 1: Stage1 done
    const [deletingEmailIds, setDeletingEmailIds] = useState(new Set());
    const [actionMessage, setActionMessage] = useState('');
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);

    const isFetchingLifetimeRef = useRef(isFetchingLifetime);
    const { listMessages, getMessageDetails, trashMessage, batchTrashMessages } = useGmailApi(accessToken);

    useEffect(() => {
        isFetchingLifetimeRef.current = isFetchingLifetime;
    }, [isFetchingLifetime]);

    const performStage1Analysis = useCallback(async () => {
        if (!accessToken || !listMessages || !getMessageDetails) {
            setProgress("Waiting for API access...");
            return;
        }
        setCurrentStage(1); // Mark as attempting stage 1
        setIsLoading(true);
        setError(null);
        setStage1SenderData({});
        setSelectedSenderForLifetime(null);
        setIsFetchingLifetime(false);
        setLifetimeEmailsDisplay([]);
        setActionMessage('');
        setProgress('Stage 1: Initializing 7-day analysis...');

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const today = new Date();
        const queryAfterTimestamp = Math.floor(sevenDaysAgo.getTime() / 1000);
        const queryBeforeTimestamp = Math.floor(today.getTime() / 1000) + (24 * 60 * 60 - 1);
        const query = `in:inbox after:${queryAfterTimestamp} before:${queryBeforeTimestamp}`;

        let currentPageTokenForStage1 = null;
        let allMessageIds = [];
        let pageCount = 0;

        try {
            setProgress('Stage 1: Fetching message IDs for last 7 days...');
            do {
                pageCount++;
                setProgress(`Stage 1: Fetching message IDs for last 7 days (page ${pageCount})...`);
                // Assuming useGmailApi().listMessages has signature: (query, pageToken, maxResults)
                // If it's (optionsObject), this should be: listMessages({ q: query, pageToken: currentPageTokenForStage1, maxResults: STAGE1_PAGE_SIZE })
                const listData = await listMessages(query, currentPageTokenForStage1, STAGE1_PAGE_SIZE);
                if (listData.messages) {
                    allMessageIds.push(...listData.messages.map(msg => msg.id));
                }
                currentPageTokenForStage1 = listData.nextPageToken;
                await sleep(200);
            } while (currentPageTokenForStage1);

            setProgress(`Stage 1: Found ${allMessageIds.length} messages. Processing metadata...`);
            const aggregatedData = {};
            for (let i = 0; i < allMessageIds.length; i++) {
                const messageId = allMessageIds[i];
                if (i > 0 && i % 20 === 0) {
                    setProgress(`Stage 1: Analyzed ${i}/${allMessageIds.length} (7-day). Pausing...`);
                    await sleep(1000);
                } else {
                    await sleep(150);
                }

                try {
                    // Assuming useGmailApi().getMessageDetails has signature: (messageId)
                    const msgData = await getMessageDetails(messageId);
                    const headers = msgData.payload?.headers;
                    if (headers) {
                        const fromHeader = headers.find(h => h.name.toLowerCase() === 'from');
                        const dateHeader = headers.find(h => h.name.toLowerCase() === 'date');
                        if (fromHeader && dateHeader) {
                            const senderDomain = normalizeDomain(fromHeader.value);
                            const receivedDate = new Date(dateHeader.value);
                            const weekKey = getISOWeek(receivedDate);

                            if (!aggregatedData[senderDomain]) aggregatedData[senderDomain] = {};
                            if (!aggregatedData[senderDomain][weekKey]) aggregatedData[senderDomain][weekKey] = 0;
                            aggregatedData[senderDomain][weekKey]++;
                        }
                    }
                } catch (msgErr) {
                    console.warn(`Stage 1 - Error processing message details for ${messageId}:`, msgErr);
                    if (msgErr.message && (msgErr.message.includes("429") || msgErr.message.includes("403"))) {
                        setProgress(`Stage 1: Rate limit hit while processing details. Pausing...`);
                        await sleep(60000);
                    }
                }
                if (i % 25 === 0 || i === allMessageIds.length - 1) {
                    setProgress(`Stage 1: Analyzed ${i + 1}/${allMessageIds.length} messages.`);
                }
            }
            setStage1SenderData(aggregatedData);
            const sortedStage1Senders = Object.entries(aggregatedData).sort(([, aData], [, bData]) => {
                const totalA = Object.values(aData).reduce((sum, count) => sum + count, 0);
                const totalB = Object.values(bData).reduce((sum, count) => sum + count, 0);
                return totalB - totalA;
            });

            if (sortedStage1Senders.length > 0) {
                setProgress('Stage 1 complete. Select a sender below to analyze their lifetime emails.');
            } else {
                setProgress('Stage 1 complete. No senders found in the last 7 days.');
            }
        } catch (e) {
            console.error("Error during Stage 1 analysis:", e);
            setError(e.message || "An unknown error occurred during Stage 1.");
            setProgress('');
            setCurrentStage(0); // Reset stage on error
        } finally {
            setIsLoading(false);
        }
    }, [accessToken, listMessages, getMessageDetails, normalizeDomain, getISOWeek]); // Added normalizeDomain, getISOWeek

    const startContinuousLifetimeFetch = useCallback(async (domainToFetch) => {
        if (!accessToken || !domainToFetch || !listMessages || !getMessageDetails) return;

        setIsFetchingLifetime(true);
        setError(null);
        setActionMessage('');
        setLifetimeEmailsDisplay([]); // Start fresh
        let currentPageToken = null;
        let emailsFetchedThisSession = 0;
        const query = `from:${domainToFetch} in:inbox`;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (!isFetchingLifetimeRef.current && currentPageToken !== null) {
                setProgress(`Lifetime email fetching for ${domainToFetch} was stopped.`);
                break;
            }
            setProgress(`Fetching page of lifetime email IDs for ${domainToFetch}... (Displayed: ${emailsFetchedThisSession})`);
            try {
                // Assuming useGmailApi().listMessages signature: (query, pageToken, maxResults, fields)
                // The 'fields' param might not be used by current gmailService.jsx
                const listData = await listMessages(query, currentPageToken, LIFETIME_ID_FETCH_PAGE_SIZE, "messages/id,nextPageToken,resultSizeEstimate");
                const messageIdsOnPage = listData.messages ? listData.messages.map(m => m.id) : [];
                currentPageToken = listData.nextPageToken || null;

                if (messageIdsOnPage.length === 0 && !currentPageToken) {
                    setProgress(`No more lifetime emails found for ${domainToFetch}. Total displayed: ${emailsFetchedThisSession}.`);
                    break;
                }

                for (let i = 0; i < messageIdsOnPage.length; i++) {
                    if (!isFetchingLifetimeRef.current) {
                        setProgress(`Lifetime email fetching for ${domainToFetch} stopped. Displayed: ${emailsFetchedThisSession}.`);
                        currentPageToken = null;
                        break;
                    }
                    const messageId = messageIdsOnPage[i];
                    await sleep(200);
                    setProgress(`Fetching details for email ${emailsFetchedThisSession + 1} from ${domainToFetch}...`);
                    try {
                        const msgData = await getMessageDetails(messageId);
                        const headers = msgData.payload?.headers;
                        const subject = headers?.find(h => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
                        const date = headers?.find(h => h.name.toLowerCase() === 'date')?.value || 'No Date';
                        const from = headers?.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
                        setLifetimeEmailsDisplay(prevEmails => [...prevEmails, { id: messageId, subject, date, from }]);
                        emailsFetchedThisSession++;
                    } catch (msgErr) {
                        console.warn(`Lifetime Fetch - Error fetching details for message ${messageId} from ${domainToFetch}:`, msgErr);
                        if (msgErr.message && (msgErr.message.includes("429") || msgErr.message.includes("403"))) {
                            setProgress(`Lifetime Fetch: Rate limit hit. Pausing...`);
                            await sleep(60000);
                        }
                    }
                }
                if (!currentPageToken) {
                    setProgress(`All available lifetime emails fetched for ${domainToFetch}. Total: ${emailsFetchedThisSession}.`);
                    break;
                }
                await sleep(500);
            } catch (e) {
                console.error("Error during lifetime email fetch loop:", e);
                setError(e.message || `Error fetching lifetime emails for ${domainToFetch}.`);
                setProgress('');
                break;
            }
        }
        setIsFetchingLifetime(false);
    }, [accessToken, listMessages, getMessageDetails]);

    const handleSenderSelectionForLifetime = useCallback(async (domain) => {
        setSelectedSenderForLifetime(domain);
        setLifetimeEmailsDisplay([]);
        setActionMessage('');
        setProgress(`Selected ${domain}. Starting lifetime email analysis...`);
        await startContinuousLifetimeFetch(domain);
    }, [startContinuousLifetimeFetch]);

    const handleStopLifetimeFetch = useCallback(() => {
        setIsFetchingLifetime(false); // Signal to stop
        if (selectedSenderForLifetime) {
            setProgress(`Stopping lifetime email fetch for ${selectedSenderForLifetime}.`);
        } else {
            setProgress(`Stopping lifetime email fetch.`);
        }
    }, [selectedSenderForLifetime]);

    const handleTrashEmail = useCallback(async (messageId, subject) => {
        if (!trashMessage) {
            console.error("trashMessage function is not available.");
            setActionMessage("Error: Delete functionality not available.");
            return;
        }
        setDeletingEmailIds(prev => new Set(prev).add(messageId));
        setActionMessage('');
        try {
            await trashMessage(messageId);
            setLifetimeEmailsDisplay(prevEmails => prevEmails.filter(email => email.id !== messageId));
            setActionMessage(`Email "${subject}" moved to Trash successfully.`);
        } catch (e) {
            console.error("Failed to trash email:", e);
            setActionMessage(`Error trashing email: ${e.message}`);
        } finally {
            setDeletingEmailIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(messageId);
                return newSet;
            });
        }
    }, [trashMessage]);

    const handleTrashAllFromSender = useCallback(async (senderDomain) => {
        // eslint-disable-next-line no-restricted-globals
        if (!confirm(`Are you sure you want to move ALL emails from "${senderDomain}" to Trash? This action might take a while and cannot be easily undone.`)) {
            return;
        }

        setIsBatchProcessing(true);
        setActionMessage(`Starting to trash all emails from ${senderDomain}...`);
        setLifetimeEmailsDisplay([]); // Clear current display for this sender

        const query = `from:${senderDomain} in:inbox`; // Or adjust query as needed
        let allMessageIdsToTrash = [];
        let pageToken = null;
        let pageCount = 0;

        try {
            setProgress(`Fetching all message IDs from ${senderDomain} to trash...`);
            do {
                pageCount++;
                setProgress(`Fetching message IDs from ${senderDomain} (page ${pageCount})...`);
                const listData = await listMessages(query, pageToken, STAGE1_PAGE_SIZE, "messages/id,nextPageToken");
                if (listData.messages) {
                    allMessageIdsToTrash.push(...listData.messages.map(msg => msg.id));
                }
                pageToken = listData.nextPageToken;
                await sleep(200); // Be nice to the API
            } while (pageToken);

            if (allMessageIdsToTrash.length === 0) {
                setActionMessage(`No emails found from ${senderDomain} to trash.`);
                setIsBatchProcessing(false);
                setProgress('');
                return;
            }

            setActionMessage(`Found ${allMessageIdsToTrash.length} emails from ${senderDomain}. Trashing in batches...`);

            for (let i = 0; i < allMessageIdsToTrash.length; i += BATCH_TRASH_CHUNK_SIZE) {
                const chunk = allMessageIdsToTrash.slice(i, i + BATCH_TRASH_CHUNK_SIZE);
                setProgress(`Trashing emails ${i + 1}-${Math.min(i + BATCH_TRASH_CHUNK_SIZE, allMessageIdsToTrash.length)} of ${allMessageIdsToTrash.length}...`);
                await batchTrashMessages(chunk);
                await sleep(500); // Pause between batches
            }

            setActionMessage(`Successfully moved all ${allMessageIdsToTrash.length} emails from ${senderDomain} to Trash.`);
            // Optionally, re-trigger stage 1 or clear sender data if appropriate
            // For now, just clear the lifetime display for this sender, which is already done.
        } catch (e) {
            console.error(`Error trashing all emails from ${senderDomain}:`, e);
            setActionMessage(`Error trashing emails from ${senderDomain}: ${e.message}. Some emails may not have been trashed.`);
        } finally {
            setIsBatchProcessing(false);
            setProgress('');
        }
    }, [listMessages, batchTrashMessages, accessToken]);

    useEffect(() => {
        // Automatically start Stage 1 analysis if conditions are met
        if (accessToken && currentStage === 0 && !isLoading && !error && listMessages && getMessageDetails) {
            performStage1Analysis();
        }
    }, [accessToken, currentStage, isLoading, error, performStage1Analysis, listMessages, getMessageDetails]);

    return {
        stage1SenderData,
        selectedSenderForLifetime,
        lifetimeEmailsDisplay,
        isFetchingLifetime,
        isLoading, // Stage 1 loading
        error,
        progress,
        currentStage,
        deletingEmailIds,
        actionMessage,
        isBatchProcessing,
        performStage1Analysis, // For retry button
        handleSenderSelectionForLifetime,
        handleStopLifetimeFetch,
        handleTrashEmail,
        handleTrashAllFromSender,
    };
}