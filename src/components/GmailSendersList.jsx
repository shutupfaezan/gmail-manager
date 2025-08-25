import React, { useState, useMemo, useCallback } from 'react';
import { useGmailAnalysis } from '../hooks/useGmailAnalysis';
import './GmailSendersList.css';
import mailIcon from '../assets/mail_icon.png';
import { stringToColor, getPaginationItems, processSenders } from '../logic/sendersPipeline';

function GmailSendersList() {
    const accessToken = sessionStorage.getItem('googleAccessToken');

    const {
        stage1SenderData,
        currentStage,
        lifetimeEmailsDisplay,
        handleSenderSelectionForLifetime,
        isLoading,
        error,
        progress,
        actionMessage,
        setActionMessage,
        isBatchProcessing,
        unsubscribeState,
        filterCreationState,
        performStage1Analysis,
        handleTrashAllFromSender,
        handleAttemptUnsubscribe,
        confirmDeleteAllFromSender,
        cancelDeleteAllFromSender,
        deleteConfirmState,
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
    } = useGmailAnalysis(accessToken);

    const [currentPage, setCurrentPage] = useState(1);
    const sendersPerPage = 10;

    const { sortedStage1DisplayData, paginatedSenders, totalPages } = useMemo(() => {
        return processSenders(stage1SenderData, currentPage, sendersPerPage);
    }, [stage1SenderData, currentPage, sendersPerPage]);

    const renderStatusBar = () => {
        if (isLoading || isBatchProcessing || unsubscribeState.isLoading || filterCreationState.isLoading) {
            return (
                <div className="status-bar">
                    <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <span>
                        {filterCreationState.isLoading
                            ? filterCreationState.message
                            : progress
                            ? progress
                            : 'Processing...'}
                    </span>
                    <span className="text-muted" style={{ fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                        {isLoading && 'Loading data...'}
                        {unsubscribeState.isLoading && 'Processing unsubscribe...'}
                        {filterCreationState.isLoading && 'Creating filter...'}
                    </span>
                </div>
            );
        }
        return null;
    };

    const renderActionStatus = () => {
        if (!actionMessage) return null;
        const isError = actionMessage.toLowerCase().startsWith("error");
        return (
            <div className={`action-status ${isError ? 'error' : 'success'}`}>
                {actionMessage}
            </div>
        );
    };

    const renderFilterCreationStatus = () => {
        if (!filterCreationState.senderIdentifier || (!filterCreationState.isLoading && !filterCreationState.message)) return null;
        const isError = filterCreationState.message && filterCreationState.message.toLowerCase().startsWith("error");
        return <div className={`filter-creation-status ${isError ? 'error' : 'success'}`}>{filterCreationState.isLoading ? `Processing filter for ${filterCreationState.senderIdentifier}...` : filterCreationState.message}</div>;
    };

    const renderUnsubscribeStatus = () => {
        if (!unsubscribeState.senderDomain || (!unsubscribeState.isLoading && !unsubscribeState.message && !unsubscribeState.link)) return null;
        return <div className="unsubscribe-status">{unsubscribeState.isLoading ? `Checking unsubscribe for ${unsubscribeState.senderDomain}...` : unsubscribeState.message}</div>;
    };

    // Deletion Modal
    const renderDeleteConfirmModal = () => {
        if (!deleteConfirmState.open) return null;

        const { countLoading, deleteLoading, domain, messageIds } = deleteConfirmState;

        return (
            <div className="modal-overlay">
                <div className="modal-content delete-modal-content">
                    <h4>Delete Emails</h4>
                    {countLoading ? (
                        <div>
                            <p>Loading emails from <b>{domain}</b>...</p>
                            <div className="dotted-spinner"></div>
                        </div>
                    ) : deleteLoading ? (
                        <div>
                            <p>Deleting <b>{messageIds.length}</b> emails from <b>{domain}</b>...</p>
                            <div className="dotted-spinner"></div>
                        </div>
                    ) : (
                        <div>
                            <p>Found <b>{messageIds.length}</b> emails from <b>{domain}</b>.</p>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'center', justifyContent: 'center' }}>
                                <button className="btn btn-danger" onClick={confirmDeleteAllFromSender}>
                                    Yes
                                </button>
                                <span className="cancel-link" onClick={cancelDeleteAllFromSender}>No</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderBulkDeleteConfirmModal = () => {
        if (!bulkDeleteState.open) return null;

        const { loading, totalCount, senders } = bulkDeleteState;

        return (
            <div className="modal-overlay">
                <div className="modal-content delete-modal-content">
                    <h4>Bulk Delete</h4>
                    {loading ? (
                        <div>
                            <p>Counting emails from <b>{senders.length}</b> senders...</p>
                            <div className="dotted-spinner"></div>
                        </div>
                    ) : (
                        <div>
                            <p>Found a total of <b>{totalCount}</b> emails from <b>{senders.length}</b> selected senders.</p>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'center', justifyContent: 'center' }}>
                                <button className="btn btn-danger" onClick={confirmBulkDelete}>
                                    Delete {totalCount} Emails
                                </button>
                                <button className="btn btn-secondary" onClick={cancelBulkDelete}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const handleBulkUnsubscribe = useCallback(async (e) => {
        e.preventDefault();
        if (selectedSenders.size === 0) {
            setActionMessage('Please select senders to unsubscribe from');
            return;
        }

        const sendersArray = Array.from(selectedSenders);
        let processed = 0;

        try {
            setActionMessage(`Processing ${sendersArray.length} senders...`);

            for (const domain of sendersArray) {
                try {
                    await handleAttemptUnsubscribe(domain);
                    processed++;
                    setActionMessage(`Processed ${processed} of ${sendersArray.length}: ${domain}`);
                } catch (error) {
                    console.error(`Failed to process ${domain}:`, error);
                    continue; // Continue with next sender even if one fails
                }
            }

            setActionMessage(`Completed processing ${processed} senders`);
            setSelectedSenders(new Set()); // Clear selections after completion
        } catch (error) {
            console.error('Bulk operation failed:', error);
            setActionMessage(`Bulk operation failed: ${error.message}`);
        }
    }, [selectedSenders, setActionMessage, handleAttemptUnsubscribe]);

    const handleIndividualDelete = useCallback((domain) => {
        if (isBatchProcessing || isDeleteInProgress) {
            return;
        }
        handleTrashAllFromSender(domain);
    }, [isBatchProcessing, isDeleteInProgress, handleTrashAllFromSender]);

    const handleBulkDelete = () => {
        if (selectedSenders.size === 0) {
            setActionMessage('Please select senders to delete.');
            return;
        }
        initiateBulkDelete(selectedSenders);
    };

    return (
        <div className="d-flex flex-column bg-light" style={{minHeight: '100vh'}}>
            {renderDeleteConfirmModal()}
            {renderBulkDeleteConfirmModal()}
            {/* Header moved to App.jsx for global use */}
            <div className="senders-list-container">
                {renderStatusBar()}
                {renderActionStatus()}
                {renderFilterCreationStatus()}
                {renderUnsubscribeStatus()}
                {error && !isLoading && !isBatchProcessing && !unsubscribeState.isLoading && !filterCreationState.isLoading && (
                    <button onClick={performStage1Analysis} style={{ marginBottom: '15px', padding: '8px 15px' }}>Retry Full Analysis</button>
                )}
                <div className='stats-container'>
                    <div className='stat-card'>
                        <div className='stat-card-info'>
                            <span className='label'>Total Senders</span>
                            <span className='value'>{isLoading && Object.keys(stage1SenderData).length === 0 ? <div className="dotted-spinner"></div> : Object.keys(stage1SenderData).length}</span>
                        </div>
                        <div className='stat-card-icon'>
                            <i className="fa-solid fa-people-group" style={{ color: '#007bff' }}></i>
                        </div>
                    </div>
                    <div className='stat-card'>
                        <div className='stat-card-info'>
                            <span className='label'>Total Emails</span>
                            <span className='value'>{isLoading && totalEmailsScanned === 0 ? <div className="dotted-spinner"></div> : totalEmailsScanned}</span>
                        </div>
                        <div className='stat-card-icon'>
                            <i className="fa-solid fa-envelope" style={{ color: '#28c267' }}></i>
                        </div>
                    </div>
                    <div className='stat-card'>
                        <div className='stat-card-info'>
                            <span className='label'>Unsubscribed</span>
                            <span className='value'>{existingFilters.size}</span>
                        </div>
                        <div className='stat-card-icon'>
                            <i className="fa-solid fa-user-slash" style={{ color: '#de1717' }}></i>
                        </div>
                    </div>
                    <div className='stat-card'>
                        <div className='stat-card-info'>
                            <span className='label'>Emails Deleted</span>
                            <span className='value'>{totalEmailsDeleted}</span>
                        </div>
                        <div className='stat-card-icon'>
                            <i className="fa-solid fa-trash" style={{ color: '#ff7000' }}></i>
                        </div>
                    </div>
                </div>
                <div className='action-buttons-container'>
                    <div className='action-buttons'>
                        <div 
                            className='action-button unsubscribe'
                            onClick={handleBulkUnsubscribe}
                            style={{ 
                                cursor: selectedSenders.size === 0 ? 'not-allowed' : 'pointer',
                                opacity: selectedSenders.size === 0 ? 0.6 : 1,
                                backgroundColor: '#dc3545',
                                color: 'white'
                            }}
                        >
                            <i className="fa-solid fa-user-slash icon"></i>
                            <span>
                                {unsubscribeState.isLoading 
                                    ? `Processing... (${unsubscribeState.senderDomain})` 
                                    : `Bulk Unsubscribe ${selectedSenders.size ? `(${selectedSenders.size})` : ''}`}
                            </span>
                        </div>
                        <div className='action-button delete' onClick={handleBulkDelete}><i className="fa-solid fa-trash icon"></i><span>Delete All Selected</span></div>
                    </div>
                </div>
                <div className='senders-list my-4'>
                {sortedStage1DisplayData.length > 0 && !isDeleteInProgress && (
                    <section className='col d-flex flex-column bg-light'>
                        <div className="senders-list-header">
                            <span className='fw-bold'>Email Senders</span>
                        </div>
                        {paginatedSenders.map(([domain, weeklyCounts]) => {
                            const totalForDomain = Object.values(weeklyCounts).reduce((sum, count) => sum + count, 0);
                                const senderInitial = domain.charAt(0).toUpperCase();
                                // Use full domain for color generation so colors vary per domain, not just by first letter
                                const avatarBg = stringToColor(domain.toLowerCase().trim());

                            return (
                                <div key={domain} className="sender-row">
                                    <div className="checkbox-container">
                                        <input
                                            type="checkbox"
                                            checked={selectedSenders.has(domain)}
                                            onChange={(e) => {
                                                const newSet = new Set(selectedSenders);
                                                if (e.target.checked) {
                                                    newSet.add(domain);
                                                } else {
                                                    newSet.delete(domain);
                                                }
                                                setSelectedSenders(newSet);
                                            }}
                                        />
                                    </div>
                                    <div className="sender-avatar" style={{ backgroundColor: avatarBg }}>
                                        {senderInitial}
                                    </div>
                                    <div className="sender-info">
                                        <div className="domain">{domain}</div>
                                        <div className="email">noreply@{domain}</div>
                                    </div>
                                    <div className="sender-emails-count">
                                        {totalForDomain} <span className="label">emails</span>
                                    </div>
                                    <div className="sender-actions">
                                        <button
                                            className="sender-action-button unsubscribe"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleAttemptUnsubscribe(domain);
                                            }}
                                            disabled={existingFilters.has(domain) || 
                                                (unsubscribeState.isLoading && unsubscribeState.senderDomain === domain)}
                                            style={{
                                                opacity: existingFilters.has(domain) ? 0.5 : 1,
                                                backgroundColor: existingFilters.has(domain) ? '#aaa' : '#dc3545',
                                                color: 'white'
                                            }}
                                        >
                                            <i className="fa-solid fa-user-slash icon"></i>
                                            <span className="text">
                                                {existingFilters.has(domain) 
                                                    ? 'Already Filtered' 
                                                    : unsubscribeState.isLoading && unsubscribeState.senderDomain === domain 
                                                        ? 'Processing...' 
                                                        : 'Unsubscribe'}
                                            </span>
                                        </button>
                                        <button
                                            className="sender-action-button delete"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleIndividualDelete(domain);
                                            }}
                                            disabled={isDeleteInProgress || isBatchProcessing}
                                            style={{
                                                opacity: (isDeleteInProgress || isBatchProcessing) ? 0.5 : 1,
                                                backgroundColor: '#ff7000',
                                                color: 'white'
                                            }}
                                        >
                                            <i className="fa-solid fa-trash icon"></i>
                                            <span className="text">
                                                {isDeleteInProgress && deleteConfirmState.domain === domain 
                                                    ? `Deleting...` 
                                                    : 'Delete'}
                                            </span>
                                        </button>
                                        <div className="view-button-container">
                                            <button
                                                className="sender-action-button view"
                                                onClick={() => handleSenderSelectionForLifetime(domain)}
                                                disabled={isLoading}
                                            >
                                                <i className="fa-solid fa-eye icon"></i>
                                                <span className="text">View</span>
                                            </button>
                                            <span className="view-tooltip">Still working on this feature</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Code error occurs below */}
                        {totalPages > 1 && (
                            <div className="pagination py-3">
                                <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Previous</button>
                                {getPaginationItems(currentPage, totalPages).map((item, index) => {
                                    if (item === '...') {
                                        return <span key={index} className="pagination-ellipsis">...</span>;
                                    }
                                    return (
                                        <button
                                            key={index}
                                            onClick={() => setCurrentPage(item)}
                                            className={currentPage === item ? 'active' : ''}
                                        >
                                            {item}
                                        </button>
                                    );
                                })}
                                <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next</button>
                            </div>
                        )}
                    </section>
                )}
                </div>
                {currentStage === 0 && !isLoading && !isBatchProcessing && Object.keys(stage1SenderData).length === 0 && lifetimeEmailsDisplay.length === 0 && (
                    <p>Analysis complete or no data found. Click "Retry" or re-login if needed.</p>
                )}
            </div>
        </div>
    );
}

export default GmailSendersList;