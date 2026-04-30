import { useState, useEffect, useCallback, useRef } from 'react';
import * as gmailService from '../services/gmailService';
import { normalizeDomain } from '../utils/gmailUtils';
import { processMessagesBatch } from './processMessagesBatch';
import { useDeleteSender } from './useDeleteSender';
import { useBulkDelete } from './useBulkDelete';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const useGmailAnalysis = (accessToken, addToast) => {
    const [stage1SenderData, setStage1SenderData] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState('');
    const [progressPct, setProgressPct] = useState(0);
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [unsubscribeState, setUnsubscribeState] = useState({ isLoading: false, senderDomain: null });
    const [existingFilters, setExistingFilters] = useState(new Set());
    const [selectedSenders, setSelectedSenders] = useState(new Set());
    const [totalEmailsScanned, setTotalEmailsScanned] = useState(0);
    const [totalEmailsDeleted, setTotalEmailsDeleted] = useState(0);

    const stopProcessingRef = useRef(false);
    const totalPagesEstimate = useRef(1);

    const {
        deleteConfirmState,
        isDeleteInProgress,
        handleTrashAllFromSender,
        confirmDeleteAllFromSender,
        cancelDeleteAllFromSender,
    } = useDeleteSender({
        accessToken,
        setActionMessage: (msg) => addToast && addToast(msg, msg.toLowerCase().startsWith('error') ? 'error' : 'success'),
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
        setActionMessage: (msg) => addToast && addToast(msg, msg.toLowerCase().startsWith('error') ? 'error' : 'success'),
        setIsBatchProcessing,
        setStage1SenderData,
        setSelectedSenders,
        setTotalEmailsDeleted,
    });

    const performStage1Analysis = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setStage1SenderData({});
        setProgress('Analyzing recent emails…');
        setProgressPct(0);
        setTotalEmailsScanned(0);
        stopProcessingRef.current = false;
        totalPagesEstimate.current = 1;

        let totalProcessed = 0;
        let pageCount = 0;
        let pageToken = null;
        let accumulator = {};

        try {
            do {
                if (stopProcessingRef.current) break;

                const response = await gmailService.listMessages(accessToken, {
                    maxResults: 100,
                    pageToken,
                });

                if (!response.messages?.length) break;

                const newCounts = await processMessagesBatch(accessToken, response.messages.map(m => m.id));

                Object.entries(newCounts).forEach(([domain, count]) => {
                    accumulator[domain] = { total: (accumulator[domain]?.total || 0) + count };
                });

                setStage1SenderData({ ...accumulator });

                totalProcessed += response.messages.length;
                pageCount++;
                setTotalEmailsScanned(totalProcessed);

                if (response.nextPageToken) {
                    totalPagesEstimate.current = Math.max(totalPagesEstimate.current, pageCount + 1);
                    setProgressPct(Math.min(90, Math.round((pageCount / totalPagesEstimate.current) * 100)));
                } else {
                    setProgressPct(100);
                }

                setProgress(`Found ${Object.keys(accumulator).length} senders in ${totalProcessed.toLocaleString()} emails`);

                pageToken = response.nextPageToken;
                if (pageToken) await sleep(500);

            } while (pageToken && !stopProcessingRef.current);

            setProgressPct(100);
            setIsLoading(false);
        } catch (err) {
            console.error('Analysis error:', err);
            setError(err.message || 'An error occurred during analysis.');
            setIsLoading(false);
        }
    }, [accessToken]);

    useEffect(() => {
        if (accessToken) {
            performStage1Analysis();
        }
        return () => { stopProcessingRef.current = true; };
    }, [accessToken]);

    const fetchExistingFilters = useCallback(async () => {
        try {
            const filters = await gmailService.listFilters(accessToken);
            const domains = new Set();
            filters.forEach(f => {
                if (f.criteria?.from) domains.add(normalizeDomain(f.criteria.from));
            });
            setExistingFilters(domains);
        } catch (err) {
            console.error('Failed to fetch filters:', err);
        }
    }, [accessToken]);

    useEffect(() => {
        if (accessToken) fetchExistingFilters();
    }, [accessToken, fetchExistingFilters]);

    const handleAttemptUnsubscribe = useCallback(async (domain) => {
        if (existingFilters.has(domain)) {
            addToast && addToast(`Filter already exists for ${domain}`, 'info');
            return;
        }

        setUnsubscribeState({ isLoading: true, senderDomain: domain });

        try {
            await gmailService.createFilter(accessToken, {
                criteria: { from: domain },
                action: { addLabelIds: ['TRASH'], removeLabelIds: ['INBOX'] },
            });
            setExistingFilters(prev => new Set([...prev, domain]));
            addToast && addToast(`Filter created for ${domain}`, 'success');
        } catch (err) {
            addToast && addToast(`Failed to create filter for ${domain}`, 'error');
        } finally {
            setUnsubscribeState({ isLoading: false, senderDomain: null });
        }
    }, [accessToken, existingFilters, addToast]);

    return {
        stage1SenderData,
        isLoading,
        error,
        progress,
        progressPct,
        performStage1Analysis,
        isBatchProcessing,
        unsubscribeState,
        handleTrashAllFromSender,
        confirmDeleteAllFromSender,
        cancelDeleteAllFromSender,
        deleteConfirmState,
        handleAttemptUnsubscribe,
        existingFilters,
        isDeleteInProgress,
        totalEmailsScanned,
        totalEmailsDeleted,
        bulkDeleteState,
        initiateBulkDelete,
        confirmBulkDelete,
        cancelBulkDelete,
        selectedSenders,
        setSelectedSenders,
    };
};
