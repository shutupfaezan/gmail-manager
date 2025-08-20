import { useState, useCallback } from 'react';
import { getAllMessageIdsFromSender, trashMessagesBatch } from './trashActions';

export const useDeleteSender = ({
    accessToken,
    setActionMessage,
    setIsBatchProcessing,
    setStage1SenderData,
    stopProcessingRef,
    setIsLoading,
}) => {
    const [deleteConfirmState, setDeleteConfirmState] = useState({ open: false, domain: null, messageIds: [], countLoading: false, deleteLoading: false });
    const [isDeleteInProgress, setIsDeleteInProgress] = useState(false);
    const [isFinished, setIsFinished] = useState(false);

    const handleTrashAllFromSender = useCallback(async (domain) => {
        setIsFinished(false);
        // Stop any ongoing analysis
        stopProcessingRef.current = true;
        setIsLoading(false);

        // Immediately open the modal in a "count loading" state
        setDeleteConfirmState({
            open: true,
            domain: domain,
            messageIds: [],
            countLoading: true,
            deleteLoading: false,
        });

        try {
            // Fetch message IDs in the background
            const messageIds = await getAllMessageIdsFromSender(accessToken, domain);

            if (messageIds.length === 0) {
                // If no emails, close the modal and show a message
                setDeleteConfirmState({ open: false, domain: null, messageIds: [], countLoading: false, deleteLoading: false });
                setActionMessage(`No emails found from ${domain}.`);
                stopProcessingRef.current = false; // Allow analysis to be restarted
                setIsFinished(true);
                return;
            }

            // Once count is fetched, update the modal state to show the confirmation message
            setDeleteConfirmState({
                open: true,
                domain: domain,
                messageIds: messageIds,
                countLoading: false,
                deleteLoading: false,
            });

        } catch (error) {
            console.error(`Failed to get messages for deletion from ${domain}:`, error);
            setActionMessage(`Error: Could not retrieve emails from ${domain}.`);
            // Close the modal on error
            setDeleteConfirmState({ open: false, domain: null, messageIds: [], countLoading: false, deleteLoading: false });
            setIsFinished(true);
        }
    }, [accessToken, setActionMessage, setIsLoading, stopProcessingRef]);

    const confirmDeleteAllFromSender = useCallback(async () => {
        if (!deleteConfirmState.domain || deleteConfirmState.messageIds.length === 0) return;

        setDeleteConfirmState(state => ({ ...state, deleteLoading: true }));
        setIsDeleteInProgress(true);

        try {
            await trashMessagesBatch(accessToken, deleteConfirmState.messageIds, setActionMessage, setIsBatchProcessing);
            
            // On success, remove the sender from the local state to update the UI
            setStage1SenderData(prevData => {
                const newData = { ...prevData };
                delete newData[deleteConfirmState.domain];
                return newData;
            });

            setActionMessage(`Successfully deleted ${deleteConfirmState.messageIds.length} emails from ${deleteConfirmState.domain}.`);

        } catch (error) {
            console.error('Failed to trash messages:', error);
            setActionMessage(`Failed to delete emails. Error: ${error.message}`);
        } finally {
            // Close the modal after deletion is attempted
            setDeleteConfirmState({ open: false, domain: null, messageIds: [], countLoading: false, deleteLoading: false });
            setIsDeleteInProgress(false);
            stopProcessingRef.current = false; // Allow analysis to be restarted
            setIsFinished(true);
        }
    }, [accessToken, deleteConfirmState, setActionMessage, setIsBatchProcessing, setStage1SenderData, stopProcessingRef]);

    const cancelDeleteAllFromSender = useCallback(() => {
        // Simply close the dialog
        setDeleteConfirmState({ open: false, domain: null, messageIds: [], countLoading: false, deleteLoading: false });
        stopProcessingRef.current = false; // Allow analysis to be restarted if needed
        setIsFinished(true);
    }, [stopProcessingRef]);

    return {
        deleteConfirmState,
        isDeleteInProgress,
        isFinished,
        handleTrashAllFromSender,
        confirmDeleteAllFromSender,
        cancelDeleteAllFromSender,
    };
};