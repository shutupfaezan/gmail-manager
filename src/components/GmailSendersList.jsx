import React from 'react'; // Removed useState, useEffect, useCallback, useRef
import { useGmailAnalysis } from '../hooks/useGmailAnalysis'; // Path to the new hook

function GmailSendersList({ accessToken }) {
    const {
        stage1SenderData,
        selectedSenderForLifetime,
        lifetimeEmailsDisplay,
        isFetchingLifetime,
        isLoading, // This is for Stage 1 loading
        error,
        progress,
        currentStage,
        deletingEmailIds,
        actionMessage,
        isBatchProcessing, // New state for batch operations
        performStage1Analysis, // For retry
        handleSenderSelectionForLifetime,
        handleStopLifetimeFetch,
        handleTrashEmail,
        handleTrashAllFromSender, // New handler
    } = useGmailAnalysis(accessToken);

    // --- UI Rendering ---
    // The renderStatusBar, renderActionStatus, and main JSX structure remain largely the same.
    // They will now use the state and handlers destructured from useGmailAnalysis.

    const renderStatusBar = () => {
        if (error) {
            return (
                <div style={{ padding: '10px', marginBottom: '15px', border: '1px solid red', borderRadius: '5px', backgroundColor: '#ffebee', color: 'red', textAlign: 'center' }}>
                    <strong>Error:</strong> {error}
                </div>
            );
        }
        // Show progress if Stage 1 is loading OR lifetime emails are being fetched OR batch processing
        if (isLoading || isFetchingLifetime || isBatchProcessing) {
            return (
                <div style={{ padding: '10px', marginBottom: '15px', border: '1px solid #007bff', borderRadius: '5px', backgroundColor: '#e7f3ff', color: '#004085', textAlign: 'center' }}>
                    {progress || "Processing..."}
                </div>
            );
        }
        // Show final progress/status message if no error and not actively loading
        if (progress && !isLoading && !isFetchingLifetime && !isBatchProcessing && !error) {
            return (
                <div style={{ padding: '10px', marginBottom: '15px', border: '1px solid #ccc', borderRadius: '5px', backgroundColor: '#f8f9fa', color: '#333', textAlign: 'center' }}>
                    Status: {progress}
                </div>
            );
        }
        return null;
    };

    const renderActionStatus = () => {
        if (!actionMessage) return null;
        return (
            <div style={{ padding: '10px', margin: '10px 0', border: '1px solid #007bff', borderRadius: '5px', backgroundColor: actionMessage.startsWith("Error") ? '#ffebee' : '#e7f3ff', color: actionMessage.startsWith("Error") ? 'red' : '#004085', textAlign: 'center' }}>
                {actionMessage}
            </div>
        );
    };

    // Confirmation for trashing email is good to keep in the component
    const confirmAndTrashEmail = (messageId, subject) => {
        // eslint-disable-next-line no-restricted-globals
        if (confirm(`Are you sure you want to move the email "${subject}" to Trash?`)) {
            handleTrashEmail(messageId, subject);
        }
    };

    const sortedStage1DisplayData = Object.entries(stage1SenderData).sort(([, aData], [, bData]) => {
        const totalA = Object.values(aData).reduce((sum, count) => sum + count, 0);
        const totalB = Object.values(bData).reduce((sum, count) => sum + count, 0);
        return totalB - totalA; // Sort descending by total emails
    });

    return (
        <div>
            {renderStatusBar()}
            {renderActionStatus()}

            {/* If there was an error, and we're not in Stage 1 loading, show retry button */}
            {error && !isLoading && !isFetchingLifetime && !isBatchProcessing && (
                 <button onClick={performStage1Analysis} style={{ marginBottom: '15px', padding: '8px 15px' }}>Retry Full Analysis</button>
            )}

            {Object.keys(stage1SenderData).length > 0 && (
                <section>
                    <h2>Stage 1: Email Senders - Last 30 Days (by Week)</h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'flex-start' }}> {/* Changed to flex-start */}
                        {sortedStage1DisplayData.map(([domain, weeklyCounts]) => {
                            const totalForDomain = Object.values(weeklyCounts).reduce((sum, count) => sum + count, 0);
                            return (
                                <div 
                                    key={`${domain}-stage1`} 
                                    style={{ 
                                        border: '1px solid #ccc', 
                                        borderRadius: '8px',
                                        padding: '16px', 
                                        margin: '8px', 
                                        width: 'calc(20% - 16px)', // Aim for 5 cards per row, accounting for gap
                                        minWidth: '220px', // Minimum width for smaller screens, adjusted slightly
                                        boxSizing: 'border-box',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}
                                >
                                    <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '1.1em' }}>{domain}</h3>
                                    <p style={{ fontSize: '0.9em', color: '#555', marginBottom: '12px' }}>30-Day Total: <strong>{totalForDomain}</strong></p>
                                    {/* Weekly breakdown removed */}
                                    <button 
                                        onClick={() => handleSenderSelectionForLifetime(domain)} 
                                        disabled={isLoading || isFetchingLifetime || isBatchProcessing} // Disable if any global loading is happening
                                        style={{ marginTop: 'auto', paddingTop: '8px', paddingBottom: '8px' }}
                                    >
                                        Analyze Lifetime Emails
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {selectedSenderForLifetime && (
                <section style={{ marginTop: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h2>Lifetime Emails from: {selectedSenderForLifetime}</h2>
                        <button
                            onClick={() => handleTrashAllFromSender(selectedSenderForLifetime)}
                            disabled={isFetchingLifetime || isLoading || isBatchProcessing || lifetimeEmailsDisplay.length === 0 && !isFetchingLifetime}
                            style={{ 
                                padding: '8px 15px', 
                                backgroundColor: '#dc3545', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '4px', 
                                cursor: 'pointer' 
                            }}
                        >
                            {isBatchProcessing ? 'Trashing All...' : `Trash All From ${selectedSenderForLifetime}`}
                        </button>
                    </div>
                    {(isFetchingLifetime || isBatchProcessing) && ( // Show loading status if fetching lifetime or batch processing
                        <div>
                            <p>{progress || (isFetchingLifetime ? `Loading lifetime emails... Displayed: ${lifetimeEmailsDisplay.length}` : "Processing batch operation...")}</p>
                            {isFetchingLifetime && <button onClick={handleStopLifetimeFetch} disabled={isBatchProcessing}>Stop Loading</button>}
                        </div>
                    )}

                    {lifetimeEmailsDisplay.map(email => {
                        const isDeleting = deletingEmailIds.has(email.id);
                        return (
                            <div key={email.id} style={{ border: '1px solid #007bff', margin: '5px', padding: '10px', fontSize: '0.9em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p><strong>Subject:</strong> {email.subject}</p>
                                    <p><strong>Date:</strong> {new Date(email.date).toLocaleString()}</p>
                                    <p style={{ fontSize: '0.8em', color: 'gray' }}>From: {email.from} (ID: {email.id})</p>
                                </div>
                                <button 
                                    onClick={() => confirmAndTrashEmail(email.id, email.subject)}
                                    disabled={isDeleting || isFetchingLifetime || isBatchProcessing}
                                    style={{ padding: '5px 10px', backgroundColor: isDeleting ? 'grey' : '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    {isDeleting ? 'Trashing...' : 'Trash'}
                                </button>
                            </div>
                        );
                    })}
                    {!isFetchingLifetime && !isBatchProcessing && lifetimeEmailsDisplay.length > 0 && !progress.includes("Fetching page") && !progress.includes("Stopping") && ( // Check progress to avoid showing this mid-fetch or on stop
                        <p style={{marginTop: '10px', fontStyle: 'italic'}}>
                            {`Displayed: ${lifetimeEmailsDisplay.length} emails. ${progress.includes("No more") || progress.includes("All available") ? progress : ''}`}
                        </p>
                    )}
                </section>
            )}
            {/* Display message if analysis is complete (or errored early) and no data is shown */}
             {currentStage === 0 && !isLoading && !isBatchProcessing && Object.keys(stage1SenderData).length === 0 && lifetimeEmailsDisplay.length === 0 && (
                <p>Analysis complete or no data found. Click "Retry" or re-login if needed.</p>
            )}
        </div>
    );
}

export default GmailSendersList;