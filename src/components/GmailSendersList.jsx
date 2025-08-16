import React, { useState } from 'react';
import { useGmailAnalysis } from '../hooks/useGmailAnalysis';
import './GmailSendersList.css';

function GmailSendersList() {
    const accessToken = sessionStorage.getItem('googleAccessToken');
    console.log('Component accessToken:', accessToken ? 'present' : 'missing');

    const {
        stage1SenderData,
        selectedSenderForLifetime,
        lifetimeEmailsDisplay,
        isFetchingLifetime,
        isLoading,
        error,
        progress,
        currentStage,
        deletingEmailIds,
        actionMessage,
        setActionMessage,  // Add this line
        isBatchProcessing,
        unsubscribeState,
        filterCreationState,
        performStage1Analysis,
        handleSenderSelectionForLifetime,
        handleStopLifetimeFetch,
        handleTrashEmail,
        handleTrashAllFromSender,
        handleAttemptUnsubscribe,
        openUnsubscribePage,
        handleCreateFilterForSender,
        confirmDeleteAllFromSender,
        cancelDeleteAllFromSender,
        deleteConfirmState,
        existingFilters, // Add existingFilters to destructured values
    } = useGmailAnalysis(accessToken);

    console.log('Component received data:', { stage1SenderData, isLoading, error, progress });

    const [currentPage, setCurrentPage] = useState(1);
    const [selectedSenders, setSelectedSenders] = useState(new Set());
    const [successCount, setSuccessCount] = useState(0); // Add this line
    const sendersPerPage = 10;

    const stringToColor = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        let color = '#';
        for (let i = 0; i < 3; i++) {
            const value = (hash >> (i * 8)) & 0xFF;
            color += ('00' + value.toString(16)).substr(-2);
        }
        return color;
    };

    const sortedStage1DisplayData = Object.entries(stage1SenderData).sort((a, b) => {
        const totalA = a[1].total || 0;
        const totalB = b[1].total || 0;
        return totalB - totalA;
    });

    console.log('stage1SenderData contents:', stage1SenderData);
    console.log('sortedStage1DisplayData:', sortedStage1DisplayData);

    const totalPages = Math.ceil(sortedStage1DisplayData.length / sendersPerPage);
    const paginatedSenders = sortedStage1DisplayData.slice(
        (currentPage - 1) * sendersPerPage,
        currentPage * sendersPerPage
    );

    const confirmAndTrashEmail = (messageId, subject) => {
        if (window.confirm(`Are you sure you want to move the email "${subject}" to Trash?`)) {
            handleTrashEmail(messageId, subject);
        }
    };

    const renderStatusBar = () => {
        if (isLoading || isFetchingLifetime || isBatchProcessing || unsubscribeState.isLoading || filterCreationState.isLoading) {
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

    // Confirmation Modal
    const renderDeleteConfirmModal = () => {
        if (!deleteConfirmState.open) return null;
        return (
            <div className="modal-overlay">
                <div className="modal-content">
                    <h4>Confirm Delete</h4>
                    <p>Are you sure you want to delete <b>{deleteConfirmState.messageIds.length}</b> emails from <b>{deleteConfirmState.domain}</b>?</p>
                    {deleteConfirmState.loading ? (
                        <p>Deleting emails...</p>
                    ) : (
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button className="btn btn-danger" onClick={confirmDeleteAllFromSender}>Confirm</button>
                            <button className="btn btn-secondary" onClick={cancelDeleteAllFromSender}>Cancel</button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const handleUnsubscribeClick = async (domain) => {
        console.log('handleUnsubscribeClick called for domain:', domain);
        
        if (isBatchProcessing || (unsubscribeState.isLoading && unsubscribeState.senderDomain === domain)) {
            console.log('Already processing this domain, skipping');
            return;
        }

        try {
            console.log('Attempting to unsubscribe from:', domain);
            await handleAttemptUnsubscribe(domain);
            
            // Update selected senders if this domain was selected
            setSelectedSenders(prev => {
                const newSet = new Set(prev);
                newSet.delete(domain);
                return newSet;
            });

            // Show success message
            setActionMessage(`Successfully unsubscribed from ${domain}`);
        } catch (error) {
            console.error('Unsubscribe failed:', error);
            setActionMessage(`Failed to unsubscribe from ${domain}: ${error.message}`);
        }
    };

    // Replace the existing handleBulkUnsubscribe function with this simpler version
    const handleBulkUnsubscribe = async (e) => {
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
    };

    const handleIndividualUnsubscribe = async (domain, e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (unsubscribeState.isLoading && unsubscribeState.senderDomain === domain) {
            console.log('Already processing this domain');
            return;
        }

        try {
            console.log('Processing individual unsubscribe for:', domain);
            await handleAttemptUnsubscribe(domain);
            
            // Remove from selected if it was selected
            setSelectedSenders(prev => {
                const newSet = new Set(prev);
                newSet.delete(domain);
                return newSet;
            });
            
            setActionMessage(`Successfully unsubscribed from ${domain}`);
        } catch (error) {
            console.error('Individual unsubscribe failed:', error);
            setActionMessage(`Failed to unsubscribe from ${domain}: ${error.message}`);
        }
    };

    return (
        <div className="d-flex flex-column bg-light" style={{minHeight: '100vh'}}>
            {renderDeleteConfirmModal()}
            <div className="d-flex align-items-center py-3 bg-white shadow-sm justify-content-center">
                <img src="../src/assets/mail_icon.png" alt="Gmail logo" style={{ width: '30px', height: '30px', marginRight: '8px' }} />
                <span style={{ fontSize: '18px', fontWeight: '600', color: 'black' }}>Gmail Unsubscriber</span>
            </div>
            <div className="senders-list-container">
                {renderStatusBar()}
                {renderActionStatus()}
                {renderFilterCreationStatus()}
                {renderUnsubscribeStatus()}
                {error && !isLoading && !isFetchingLifetime && !isBatchProcessing && !unsubscribeState.isLoading && !filterCreationState.isLoading && (
                    <button onClick={performStage1Analysis} style={{ marginBottom: '15px', padding: '8px 15px' }}>Retry Full Analysis</button>
                )}

                <div className='stats-container'>
                    <div className='stat-card'>
                        <div className='stat-card-info'>
                            <span className='label'>Total Senders</span>
                            <span className='value'>247</span>
                        </div>
                        <div className='stat-card-icon'>
                            <i className="fa-solid fa-people-group" style={{ color: '#007bff' }}></i>
                        </div>
                    </div>
                    <div className='stat-card'>
                        <div className='stat-card-info'>
                            <span className='label'>Total Emails</span>
                            <span className='value'>247</span>
                        </div>
                        <div className='stat-card-icon'>
                            <i className="fa-solid fa-envelope" style={{ color: '#28c267' }}></i>
                        </div>
                    </div>
                    <div className='stat-card'>
                        <div className='stat-card-info'>
                            <span className='label'>Unsubscribed</span>
                            <span className='value'>247</span>
                        </div>
                        <div className='stat-card-icon'>
                            <i className="fa-solid fa-user-slash" style={{ color: '#de1717' }}></i>
                        </div>
                    </div>
                    <div className='stat-card'>
                        <div className='stat-card-info'>
                            <span className='label'>Emails Deleted</span>
                            <span className='value'>247</span>
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
                        <div className='action-button delete'><i className="fa-solid fa-trash icon"></i><span>Delete All Selected</span></div>
                    </div>
                </div>
                <div className='senders-list'>
                {sortedStage1DisplayData.length > 0 && (
                    <section className='col d-flex flex-column bg-light'>
                        <div className="senders-list-header">
                            <span className='fw-bold'>Email Senders</span>
                        </div>
                        {paginatedSenders.map(([domain, weeklyCounts]) => {
                            const totalForDomain = Object.values(weeklyCounts).reduce((sum, count) => sum + count, 0);
                            const senderInitial = domain.charAt(0).toUpperCase();
                            const avatarBg = stringToColor(senderInitial);

                            return (
                                <div key={domain} className="sender-row">
                                    <div className="checkbox-container">
                                        <input
                                            type="checkbox"
                                            checked={selectedSenders.has(domain)}
                                            onChange={(e) => {
                                                setSelectedSenders(prev => {
                                                    const newSet = new Set(prev);
                                                    if (e.target.checked) {
                                                        newSet.add(domain);
                                                    } else {
                                                        newSet.delete(domain);
                                                    }
                                                    return newSet;
                                                });
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
                                            onClick={() => handleTrashAllFromSender(domain)}
                                            disabled={isLoading || isBatchProcessing}
                                        >
                                            <i className="fa-solid fa-trash icon"></i>
                                            <span className="text">Delete</span>
                                        </button>
                                        <button
                                            className="sender-action-button view"
                                            onClick={() => handleSenderSelectionForLifetime(domain)}
                                            disabled={isLoading}
                                        >
                                            <i className="fa-solid fa-eye icon"></i>
                                            <span className="text">View</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {totalPages > 1 && (
                            <div className="pagination">
                                <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Previous</button>
                                {Array.from({ length: totalPages }, (_, i) => (
                                    <button
                                        key={i + 1}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={currentPage === i + 1 ? 'active' : ''}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                                <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next</button>
                            </div>
                        )}
                    </section>
                )}
                </div>
                {/* Remove the lifetime-emails-section and only show progress in the status/progress bar */}
                {/* {selectedSenderForLifetime && (
                    <section className="lifetime-emails-section">
                        <h2>Lifetime Emails from: {selectedSenderForLifetime}</h2>
                        {(isFetchingLifetime || isBatchProcessing) && (
                            <div>
                                <p>{progress || `Loading emails... Displayed: ${lifetimeEmailsDisplay.length}`}</p>
                                {isFetchingLifetime && <button onClick={handleStopLifetimeFetch}>Stop Loading</button>}
                            </div>
                        )}
                        {lifetimeEmailsDisplay.map(email => {
                            const isDeleting = deletingEmailIds.has(email.id);
                            return (
                                <div key={email.id} className="lifetime-email-row">
                                    <div>
                                        <p><strong>Subject:</strong> {email.subject}</p>
                                        <p><strong>Date:</strong> {new Date(email.date).toLocaleString()}</p>
                                        <p style={{ fontSize: '0.8em', color: 'gray' }}>From: {email.from}</p>
                                    </div>
                                    <button
                                        onClick={() => confirmAndTrashEmail(email.id, email.subject)}
                                        disabled={isDeleting}
                                        className={`trash ${isDeleting ? 'disabled' : ''}`}
                                    >
                                        {isDeleting ? 'Trashing...' : 'Trash'}
                                    </button>
                                </div>
                            );
                        })}
                    </section>
                )} */}

                {currentStage === 0 && !isLoading && !isBatchProcessing && Object.keys(stage1SenderData).length === 0 && lifetimeEmailsDisplay.length === 0 && (
                    <p>Analysis complete or no data found. Click "Retry" or re-login if needed.</p>
                )}
            </div>
        </div>
    );
}

export default GmailSendersList;

