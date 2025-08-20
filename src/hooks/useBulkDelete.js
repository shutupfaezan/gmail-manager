import { useState, useCallback } from 'react';
import { getAllMessageIdsFromSender, trashMessagesBatch } from './trashActions';

export const useBulkDelete = ({
    accessToken,
    setActionMessage,
    setIsBatchProcessing,
    setStage1SenderData,
    setSelectedSenders,
}) => {
    const [bulkDeleteState, setBulkDeleteState] = useState({ open: false, senders: [], totalCount: 0, messageIds: [], loading: false });

    const initiateBulkDelete = useCallback(async (senders) => {
        const sendersArray = Array.from(senders);
        setBulkDeleteState({ open: true, senders: sendersArray, totalCount: 0, messageIds: [], loading: true });
        let totalCount = 0;
        let allMessageIds = [];

        try {
            for (const sender of sendersArray) {
                const messageIds = await getAllMessageIdsFromSender(accessToken, sender);
                totalCount += messageIds.length;
                allMessageIds.push(...messageIds);
            }
            setBulkDeleteState({ open: true, senders: sendersArray, totalCount: totalCount, messageIds: allMessageIds, loading: false });
        } catch (error) {
            console.error('Failed to get messages for bulk deletion:', error);
            setActionMessage(`Error: Could not retrieve emails for bulk deletion.`);
            setBulkDeleteState({ open: false, senders: [], totalCount: 0, messageIds: [], loading: false });
        }
    }, [accessToken, setActionMessage]);

    const confirmBulkDelete = useCallback(async () => {
        if (bulkDeleteState.messageIds.length === 0) return;

        setBulkDeleteState(state => ({ ...state, loading: true }));
        setIsBatchProcessing(true);

        try {
            await trashMessagesBatch(accessToken, bulkDeleteState.messageIds, setActionMessage, setIsBatchProcessing);
            
            setStage1SenderData(prevData => {
                const newData = { ...prevData };
                for (const sender of bulkDeleteState.senders) {
                    delete newData[sender];
                }
                return newData;
            });

            setSelectedSenders(new Set()); // Clear selection
            setActionMessage(`Successfully deleted ${bulkDeleteState.totalCount} emails.`);

        } catch (error) {
            console.error('Failed to bulk delete messages:', error);
            setActionMessage(`Failed to delete emails. Error: ${error.message}`);
        } finally {
            setBulkDeleteState({ open: false, senders: [], totalCount: 0, messageIds: [], loading: false });
            setIsBatchProcessing(false);
        }
    }, [accessToken, bulkDeleteState, setActionMessage, setIsBatchProcessing, setStage1SenderData, setSelectedSenders]);

    const cancelBulkDelete = useCallback(() => {
        setBulkDeleteState({ open: false, senders: [], totalCount: 0, messageIds: [], loading: false });
    }, []);

    return {
        bulkDeleteState,
        initiateBulkDelete,
        confirmBulkDelete,
        cancelBulkDelete,
    };
};