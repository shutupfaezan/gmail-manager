import React, { useState } from 'react';
import { useGmailAnalysis } from '../hooks/useGmailAnalysis';

function GmailSendersList() {
    const accessToken = sessionStorage.getItem('googleAccessToken');
    console.log("GmailSendersList accessToken:", accessToken);

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
    } = useGmailAnalysis(accessToken);

    const [currentPage, setCurrentPage] = useState(1);
    const sendersPerPage = 10;

    const stringToColor = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return `#${'00000'.substring(0, 6 - c.length)}${c}`;
    };

    const sortedStage1DisplayData = Object.entries(stage1SenderData).sort(([, aData], [, bData]) => {
        const totalA = Object.values(aData).reduce((sum, count) => sum + count, 0);
        const totalB = Object.values(bData).reduce((sum, count) => sum + count, 0);
        return totalB - totalA;
    });

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
        if (error) {
            return <div style={{ padding: '10px', marginBottom: '15px', border: '1px solid red', borderRadius: '5px', backgroundColor: '#ffebee', color: 'red', textAlign: 'center' }}><strong>Error:</strong> {error}</div>;
        }
        if (isLoading || isFetchingLifetime || isBatchProcessing || unsubscribeState.isLoading || filterCreationState.isLoading) {
            return <div style={{ padding: '10px', marginBottom: '15px', border: '1px solid #007bff', borderRadius: '5px', backgroundColor: '#e7f3ff', color: '#004085', textAlign: 'center' }}>{filterCreationState.isLoading ? filterCreationState.message : progress || "Processing..."}</div>;
        }
        if (progress) {
            return <div style={{ padding: '10px', marginBottom: '15px', border: '1px solid #ccc', borderRadius: '5px', backgroundColor: '#f8f9fa', color: '#333', textAlign: 'center' }}>Status: {progress}</div>;
        }
        return null;
    };

    const renderActionStatus = () => {
        if (!actionMessage) return null;
        const isError = actionMessage.toLowerCase().startsWith("error");
        return (
            <div style={{ padding: '10px', margin: '10px 0', border: `1px solid ${isError ? 'red' : '#007bff'}`, borderRadius: '5px', backgroundColor: isError ? '#ffebee' : '#e7f3ff', color: isError ? 'red' : '#004085', textAlign: 'center' }}>
                {actionMessage}
            </div>
        );
    };

    const renderFilterCreationStatus = () => {
        if (!filterCreationState.senderIdentifier || (!filterCreationState.isLoading && !filterCreationState.message)) return null;
        const isError = filterCreationState.message && filterCreationState.message.toLowerCase().startsWith("error");
        return <div style={{ padding: '10px', margin: '10px 0', border: `1px solid ${isError ? 'red' : '#28a745'}`, borderRadius: '5px', backgroundColor: isError ? '#ffebee' : '#e6ffed', color: isError ? 'red' : '#155724', textAlign: 'center' }}>{filterCreationState.isLoading ? `Processing filter for ${filterCreationState.senderIdentifier}...` : filterCreationState.message}</div>;
    };

    const renderUnsubscribeStatus = () => {
        if (!unsubscribeState.senderDomain || (!unsubscribeState.isLoading && !unsubscribeState.message && !unsubscribeState.link)) return null;
        return <div style={{ padding: '10px', margin: '10px 0', border: '1px solid #17a2b8', borderRadius: '5px', backgroundColor: '#d1ecf1', color: '#0c5460', textAlign: 'center' }}>{unsubscribeState.isLoading ? `Checking unsubscribe for ${unsubscribeState.senderDomain}...` : unsubscribeState.message}</div>;
    };

    return (
        <div  className="d-flex flex-column bg-light" style={{minHeight: '100vh'}}>
            <div className="d-flex align-items-center py-3 bg-white shadow-sm justify-content-center">
                <img src="../src/assets/mail_icon.png" alt="Gmail logo" style={{ width: '30px', height: '30px', marginRight: '8px' }} />
                <span style={{ fontSize: '18px', fontWeight: '600', color: 'black' }}>Gmail Unsubscriber</span>
            </div>
            <div className="col-11 mx-auto my-4" style={{ backgroundColor: '#f8f9fa', borderRadius: '10px', padding: '20px' }}>
                {renderStatusBar()}
                {renderActionStatus()}
                {renderFilterCreationStatus()}
                {renderUnsubscribeStatus()}
                {error && !isLoading && !isFetchingLifetime && !isBatchProcessing && !unsubscribeState.isLoading && !filterCreationState.isLoading && (
                    <button onClick={performStage1Analysis} style={{ marginBottom: '15px', padding: '8px 15px' }}>Retry Full Analysis</button>
                )}

                <div className='d-flex align-items-center justify-content-center p-4' style={{ gap: '20px', flexWrap: 'wrap' }}>
                    <div className='col d-flex bg-white p-3' style={{ borderRadius: '10px', border: "1px solid #80808047"}}>
                        <div className='d-flex flex-column justify-content-center' style={{ flex: 1 }}>
                            <span style={{ fontWeight: '600', fontSize: '14px', marginBottom: '-5px', color: '#00000085' }}>Total Senders</span>
                            <span style={{ fontSize: '24px', fontWeight: '500' }}>247</span>
                        </div>
                        <div className='d-flex align-items-center' style={{ marginLeft: '12px' }}>
                            <i className="fa-solid fa-people-group" style={{ fontSize: '20px', color: '#007bff' }}></i>
                        </div>
                    </div>
                    <div className='col d-flex bg-white p-3' style={{ borderRadius: '10px', border: "1px solid #80808047"}}>
                        <div className='d-flex flex-column justify-content-center' style={{ flex: 1 }}>
                            <span style={{ fontWeight: '600', fontSize: '14px', marginBottom: '-5px', color: '#00000085' }}>Total Emails</span>
                            <span style={{ fontSize: '24px', fontWeight: '500' }}>247</span>
                        </div>
                        <div className='d-flex align-items-center' style={{ marginLeft: '12px' }}>
                            <i className="fa-solid fa-envelope" style={{ fontSize: '20px', color: '#28c267' }}></i>
                        </div>
                    </div>
                    <div className='col d-flex bg-white p-3' style={{ borderRadius: '10px', border: "1px solid #80808047"}}>
                        <div className='d-flex flex-column justify-content-center' style={{ flex: 1 }}>
                            <span style={{ fontWeight: '600', fontSize: '14px', marginBottom: '-5px', color: '#00000085' }}>Unsubscribed</span>
                            <span style={{ fontSize: '24px', fontWeight: '500' }}>247</span>
                        </div>
                        <div className='d-flex align-items-center' style={{ marginLeft: '12px' }}>
                            <i className="fa-solid fa-user-slash" style={{ fontSize: '20px', color: '#de1717' }}></i>
                        </div>
                    </div>
                    <div className='col d-flex bg-white p-3' style={{ borderRadius: '10px', border: "1px solid #80808047"}}>
                        <div className='d-flex flex-column justify-content-center' style={{ flex: 1 }}>
                            <span style={{ fontWeight: '600', fontSize: '14px', marginBottom: '-5px', color: '#00000085' }}>Emails Deleted</span>
                            <span style={{ fontSize: '24px', fontWeight: '500' }}>247</span>
                        </div>
                        <div className='d-flex align-items-center' style={{ marginLeft: '12px' }}>
                            <i className="fa-solid fa-trash" style={{ fontSize: '20px', color: '#ff7000' }}></i>
                        </div>
                    </div>
                </div>
                <div className='d-flex align-items-center justify-content-center p-4' >
                    <div className='col d-flex bg-white p-3' style={{ borderRadius: '10px', border: "0.2px solid #80808047", gap: "10px"}}>
                        <div className='d-flex justify-content-center py-1 px-2 rounded align-items-center' style={{background: "#de1717", gap: "8px"}}><i className="fa-solid fa-user-slash" style={{ fontSize: '12px', color: 'white' }}></i><span style={{fontWeight: '600', fontSize: '14px', color: 'white' }}>Unsubscribe All Selected</span></div>
                        <div className='d-flex justify-content-center py-1 px-2 rounded align-items-center' style={{background: "#ff7000", gap: "8px"}}><i className="fa-solid fa-trash" style={{ fontSize: '12px', color: 'white' }}></i><span style={{fontWeight: '600', fontSize: '14px', color: 'white' }}>Delete All Selected</span></div>
                    </div>
                </div>
                <div className='d-flex align-items-center justify-content-center p-4'>
                {sortedStage1DisplayData.length > 0 && (
                    <section className='col d-flex flex-column bg-light'>
                        <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ alignItems: 'center', padding: '10px 16px', backgroundColor: '#ffffffff', fontWeight: 'bold'}}>
                                <span className='fw-bold'>Email Senders</span>
                            </div>
                            {paginatedSenders.map(([domain, weeklyCounts]) => {
                                const totalForDomain = Object.values(weeklyCounts).reduce((sum, count) => sum + count, 0);
                                const senderInitial = domain.charAt(0).toUpperCase();
                                const avatarBg = stringToColor(senderInitial);

                                return (
                                    <div key={domain} style={{
                                        display: 'grid',
                                        background: '#fff',
                                        gridTemplateColumns: '40px 1fr 100px 300px',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        borderTop: '1px solid #eee',
                                        fontSize: '0.95em'
                                    }}>
                                        <div>
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                backgroundColor: avatarBg,
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 'bold'
                                            }}>{senderInitial}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>{domain}</div>
                                            <div style={{ fontSize: '0.85em', color: '#777' }}>noreply@{domain}</div>
                                        </div>
                                        <div style={{ fontWeight: 'bold' }}>{totalForDomain} <span style={{ fontWeight: 'normal', color: '#666' }}>emails</span></div>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            <button
                                                onClick={() => handleAttemptUnsubscribe(domain)}
                                                disabled={isLoading || isFetchingLifetime || unsubscribeState.isLoading}
                                                style={{ backgroundColor: '#f44336', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                {unsubscribeState.isLoading && unsubscribeState.senderDomain === domain ? 'Checking...' : 'Unsubscribe'}
                                            </button>
                                            <button
                                                onClick={() => handleTrashAllFromSender(domain)}
                                                disabled={isLoading || isBatchProcessing}
                                                style={{ backgroundColor: '#ff9800', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                Delete
                                            </button>
                                            <button
                                                onClick={() => handleSenderSelectionForLifetime(domain)}
                                                disabled={isLoading}
                                                style={{ backgroundColor: '#2196f3', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                View
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {totalPages > 1 && (
                            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Previous</button>
                                {Array.from({ length: totalPages }, (_, i) => (
                                    <button
                                        key={i + 1}
                                        onClick={() => setCurrentPage(i + 1)}
                                        style={{
                                            padding: '6px 12px',
                                            backgroundColor: currentPage === i + 1 ? '#007bff' : '#f0f0f0',
                                            color: currentPage === i + 1 ? '#fff' : '#000',
                                            border: 'none',
                                            borderRadius: '4px'
                                        }}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                                <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next</button>
                            </div>
                        )}
                    </section>
                )}
                {selectedSenderForLifetime && (
                    <section style={{ marginTop: '30px' }}>
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
                                <div key={email.id} style={{ border: '1px solid #007bff', margin: '5px', padding: '10px', fontSize: '0.9em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p><strong>Subject:</strong> {email.subject}</p>
                                        <p><strong>Date:</strong> {new Date(email.date).toLocaleString()}</p>
                                        <p style={{ fontSize: '0.8em', color: 'gray' }}>From: {email.from}</p>
                                    </div>
                                    <button
                                        onClick={() => confirmAndTrashEmail(email.id, email.subject)}
                                        disabled={isDeleting}
                                        style={{ padding: '5px 10px', backgroundColor: isDeleting ? 'gray' : '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
                                    >
                                        {isDeleting ? 'Trashing...' : 'Trash'}
                                    </button>
                                </div>
                            );
                        })}
                    </section>
                )}

                {currentStage === 0 && !isLoading && !isBatchProcessing && Object.keys(stage1SenderData).length === 0 && lifetimeEmailsDisplay.length === 0 && (
                    <p>Analysis complete or no data found. Click "Retry" or re-login if needed.</p>
                )}
            </div>
        </div>
        </div>
    );
}

export default GmailSendersList;
