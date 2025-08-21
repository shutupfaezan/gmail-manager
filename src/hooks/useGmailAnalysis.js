import { useState, useEffect, useCallback, useRef } from 'react';
import * as gmailService from '../services/gmailService';
import { normalizeDomain } from '../utils/gmailUtils';
import { processMessagesBatch } from './processMessagesBatch';
import { useDeleteSender } from './useDeleteSender';
import { useBulkDelete } from './useBulkDelete';

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
    const [existingFilters, setExistingFilters] = useState(new Set());
    const [selectedSenders, setSelectedSenders] = useState(new Set());
    const [totalEmailsDeleted, setTotalEmailsDeleted] = useState(0);

    const stopProcessingRef = useRef(false);

    const {
        deleteConfirmState,
        isDeleteInProgress,
        isFinished: deleteProcessFinished,
        handleTrashAllFromSender,
        confirmDeleteAllFromSender,
        cancelDeleteAllFromSender,
    } = useDeleteSender({
        accessToken,
        setActionMessage,
        setIsBatchProcessing,
        setStage1SenderData,
        stopProcessingRef,
        setIsLoading,
        setTotalEmailsDeleted,
    });

    const {
        bulkDeleteState,
        initiateBulkDelete,
        confirmBulkDelete,
        cancelBulkDelete,
    } = useBulkDelete({
        accessToken,
        setActionMessage,
        setIsBatchProcessing,
        setStage1SenderData,
        setSelectedSenders,
        setTotalEmailsDeleted,
    });

    const [totalEmailsScanned, setTotalEmailsScanned] = useState(0);

    useEffect(() => {
        if (progress.includes('Analysis complete')) {
            const matches = progress.match(/(\d+)/);
            if (matches) {
                setTotalEmailsScanned(parseInt(matches[0], 10));
            }
        }
    }, [progress]);

    // --- Core Logic ---

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
        let pageToken = null;
        const maxResults = 100; // Process 100 emails at a time

        try {
            setProgress('Analyzing recent emails...');
            
            do {
                if (stopProcessingRef.current) {
                    break;
                }
                let response = await gmailService.listMessages(accessToken, { 
                    maxResults: maxResults,
                    pageToken: pageToken 
                });
                
                if (response.messages && response.messages.length > 0) {
                    const messageIds = response.messages.map(m => m.id);
                    const newCounts = await processMessagesBatch(accessToken, messageIds);

                    // Merge newCounts into accumulator
                    Object.entries(newCounts).forEach(([domain, count]) => {
                        currentSenderDataAccumulator[domain] = { 
                            total: (currentSenderDataAccumulator[domain]?.total || 0) + count 
                        };
                    });
                    
                    // Update state with current progress
                    setStage1SenderData({ ...currentSenderDataAccumulator });
                    
                    totalProcessedMessages += messageIds.length;
                    setTotalEmailsScanned(totalProcessedMessages);
                    setProgress(`Found ${Object.keys(currentSenderDataAccumulator).length} senders in ${totalProcessedMessages} emails...`);
                    
                    // Get next page token for continuation
                    pageToken = response.nextPageToken;
                    
                    // Small delay to avoid rate limiting
                    await sleep(500);
                } else {
                    break;
                }
                
            } while (pageToken && !stopProcessingRef.current);

            setIsLoading(false);
            setCurrentStage(0);
            setProgress(`Analysis complete. Scanned a total of ${totalProcessedMessages} emails.`);
            
        } catch (err) {
            console.error('Analysis error:', err);
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
    }, [accessToken]);

    useEffect(() => {
        if (deleteProcessFinished) {
            performStage1Analysis();
        }
    }, [deleteProcessFinished, performStage1Analysis]);

    // --- Placeholder Handlers for Other Features ---
    const handleSenderSelectionForLifetime = useCallback((domain) => {
        setSelectedSenderForLifetime(domain);
        setActionMessage(`Feature not implemented: Analyze Lifetime Emails for ${domain}`);
    }, []);

    const handleStopLifetimeFetch = useCallback(() => {
        setActionMessage("Feature not implemented: Stop Lifetime Fetch");
    }, []);

    const handleTrashEmail = useCallback(async (messageId, subject) => {
        setDeletingEmailIds(prev => new Set(prev).add(messageId));
        setActionMessage(`Attempting to trash email: "${subject}"...`);
        try {
            await gmailService.trashMessage(accessToken, messageId);
            setActionMessage(`Successfully trashed email: "${subject}".`);
        } catch (error) {
            setActionMessage(`Failed to trash email: "${subject}". Error: ${error.message}`);
        } finally {
            setDeletingEmailIds(prev => {
                const newState = new Set(prev);
                newState.delete(messageId);
                return newState;
            });
        }
    }, [accessToken]);

    // Add a function to fetch and process existing filters
    const fetchExistingFilters = useCallback(async () => {
        try {
            const filters = await gmailService.listFilters(accessToken);
            const filteredDomains = new Set();
            
            // Extract domains from filter criteria
            filters.forEach(filter => {
                if (filter.criteria && filter.criteria.from) {
                    const domain = normalizeDomain(filter.criteria.from);
                    filteredDomains.add(domain);
                }
            });
            
            setExistingFilters(filteredDomains);
        } catch (error) {
            console.error('Failed to fetch filters:', error);
        }
    }, [accessToken]);

    // Add useEffect to fetch filters on mount
    useEffect(() => {
        if (accessToken) {
            fetchExistingFilters();
        }
    }, [accessToken, fetchExistingFilters]);

    const handleAttemptUnsubscribe = useCallback(async (domain) => {
        // Check if already filtered
        if (existingFilters.has(domain)) {
            setUnsubscribeState({
                isLoading: false, 
                message: `Filter already exists for ${domain}`,
                link: null, 
                senderDomain: domain 
            });
            return;
        }

        setUnsubscribeState({
            isLoading: true, 
            message: `Creating filter to delete emails from ${domain}...`,
            link: null, 
            senderDomain: domain 
        });

        try {
            const criteria = { from: domain };
            const action = { addLabelIds: ['TRASH'], removeLabelIds: ['INBOX'] };
            await gmailService.createFilter(accessToken, { criteria, action });
            
            // Add to existing filters
            setExistingFilters(prev => new Set([...prev, domain]));
            
            setUnsubscribeState({
                isLoading: false, 
                message: `Successfully created filter for ${domain}.`,
                link: null, 
                senderDomain: domain 
            });
        } catch (error) {
            console.error('Error creating filter for', domain, ':', error);
            setUnsubscribeState({
                isLoading: false, 
                message: `Error creating filter for ${domain}: ${error.message}`,
                link: null, 
                senderDomain: domain 
            });
        }
    }, [accessToken, existingFilters]);

    const openUnsubscribePage = useCallback((link) => {
        if (link) {
            window.open(link, '_blank', 'noopener,noreferrer');
            setActionMessage('Unsubscribe page opened in a new tab.');
        } else {
            setActionMessage('No unsubscribe link available to open.');
        }
    }, []);

    const handleCreateFilterForSender = useCallback(async (domain) => {
        setFilterCreationState({ isLoading: true, message: `Creating filter for ${domain}...`, senderIdentifier: domain });
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            setFilterCreationState({ isLoading: false, message: `Filter created for ${domain} (stub).`, senderIdentifier: domain });
            setActionMessage(`Filter for ${domain} created successfully (stub).`);
        } catch (error) {
            setFilterCreationState({ isLoading: false, message: `Failed to create filter for ${domain}: ${error.message}`, senderIdentifier: domain });
            setActionMessage(`Failed to create filter for ${domain}. Error: ${error.message}`);
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
        setActionMessage,
        deletingEmailIds,
        isBatchProcessing,
        unsubscribeState,
        filterCreationState,
        handleTrashEmail,
        handleTrashAllFromSender,
        confirmDeleteAllFromSender,
        cancelDeleteAllFromSender,
        deleteConfirmState,
        handleAttemptUnsubscribe,
        openUnsubscribePage,
        handleCreateFilterForSender,
        existingFilters,
        isDeleteInProgress,
        totalEmailsScanned,
        totalEmailsDeleted,
        // for bulk delete
        bulkDeleteState,
        initiateBulkDelete,
        confirmBulkDelete,
        cancelBulkDelete,
        selectedSenders,
        setSelectedSenders,
    };
};