import { useState, useEffect, useCallback, useRef } from 'react';
import * as gmailService from '../services/gmailService';
import { normalizeDomain } from '../utils/gmailUtils';
import { processMessagesBatch } from './processMessagesBatch';
import { getAllMessageIdsFromSender, trashMessagesBatch } from './trashActions';

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
    const [deleteConfirmState, setDeleteConfirmState] = useState({ open: false, domain: null, messageIds: [], loading: false });
    const [existingFilters, setExistingFilters] = useState(new Set());

    const stopProcessingRef = useRef(false);

    // --- Core Logic ---

    const performStage1Analysis = useCallback(async () => {
        console.log('Starting analysis with token:', accessToken ? 'present' : 'missing');
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
                console.log('Making Gmail API call...');
                let response = await gmailService.listMessages(accessToken, { 
                    maxResults: maxResults,
                    pageToken: pageToken 
                });
                console.log('Gmail API response:', response);
                
                if (response.messages && response.messages.length > 0) {
                    const messageIds = response.messages.map(m => m.id);
                    console.log('Processing', messageIds.length, 'messages');
                    const newCounts = await processMessagesBatch(accessToken, messageIds);
                    console.log('Processed counts:', newCounts);

                    // Merge newCounts into accumulator
                    Object.entries(newCounts).forEach(([domain, count]) => {
                        currentSenderDataAccumulator[domain] = { 
                            total: (currentSenderDataAccumulator[domain]?.total || 0) + count 
                        };
                    });
                    
                    // Update state with current progress
                    setStage1SenderData({ ...currentSenderDataAccumulator });
                    
                    totalProcessedMessages += messageIds.length;
                    setProgress(`Found ${Object.keys(currentSenderDataAccumulator).length} senders in ${totalProcessedMessages} emails...`);
                    
                    // Get next page token for continuation
                    pageToken = response.nextPageToken;
                    
                    // Small delay to avoid rate limiting
                    await sleep(500);
                } else {
                    console.log('No more messages found');
                    break;
                }
                
                // Stop if we've processed enough emails or if user stopped
                if (stopProcessingRef.current) {
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
    }, [accessToken, performStage1Analysis]);

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

    // --- Delete All From Sender with Confirmation ---
    const handleTrashAllFromSender = useCallback(async (domain) => {
        console.log('handleTrashAllFromSender called for domain:', domain);
        // Pause background analysis
        stopProcessingRef.current = true;
        setIsBatchProcessing(true);
        setActionMessage(`Finding all emails from ${domain}...`);
        try {
            console.log('Fetching message IDs for domain:', domain);
            const messageIds = await getAllMessageIdsFromSender(accessToken, domain);
            console.log('Found', messageIds.length, 'message IDs for domain:', domain);
            setDeleteConfirmState({ open: true, domain, messageIds, loading: false });
            setIsBatchProcessing(false);
        } catch (error) {
            console.error('Failed to fetch emails for', domain, ':', error);
            setActionMessage(`Failed to fetch emails for ${domain}: ${error.message}`);
            setIsBatchProcessing(false);
        }
    }, [accessToken]);

    const confirmDeleteAllFromSender = useCallback(async () => {
        if (!deleteConfirmState.domain || deleteConfirmState.messageIds.length === 0) return;
        setDeleteConfirmState(state => ({ ...state, loading: true }));
        await trashMessagesBatch(accessToken, deleteConfirmState.messageIds, setActionMessage, setIsBatchProcessing);
        setDeleteConfirmState({ open: false, domain: null, messageIds: [], loading: false });
        // Resume analysis after deletion
        stopProcessingRef.current = false;
        performStage1Analysis();
    }, [accessToken, deleteConfirmState, performStage1Analysis]);

    const cancelDeleteAllFromSender = useCallback(() => {
        setDeleteConfirmState({ open: false, domain: null, messageIds: [], loading: false });
        stopProcessingRef.current = false;
        setIsBatchProcessing(false);
        performStage1Analysis();
    }, [performStage1Analysis]);

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
            console.log('Existing filtered domains:', filteredDomains);
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
        console.log('handleAttemptUnsubscribe called for domain:', domain);
        
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
            console.log('Creating filter with criteria:', criteria, 'action:', action);
            await gmailService.createFilter(accessToken, { criteria, action });
            
            // Add to existing filters
            setExistingFilters(prev => new Set([...prev, domain]));
            
            console.log('Filter created successfully for:', domain);
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
    };
};
