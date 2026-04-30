import React, { useState, useMemo, useCallback } from 'react';
import { useGmailAnalysis } from '../hooks/useGmailAnalysis';
import { useToast } from '../hooks/useToast';
import './GmailSendersList.css';

const AVATAR_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];
const avatarColor = d => AVATAR_COLORS[d.charCodeAt(0) % AVATAR_COLORS.length];
const fmt = n => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);

const ChevronL = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const ChevronR = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;

// ── Toast container ──────────────────────────────────────────
function Toasts({ toasts }) {
    const ic = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const cl = { success: '#10b981', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b' };
    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={t.out ? 't-out' : 't-in'}
                    style={{ display: 'flex', alignItems: 'center', gap: 10,
                        background: 'white', borderRadius: 12,
                        boxShadow: '0 8px 28px rgba(0,0,0,.14)',
                        padding: '12px 16px',
                        borderLeft: `4px solid ${cl[t.type]}`,
                        pointerEvents: 'auto' }}>
                    <span className="toast-icon" style={{ color: cl[t.type] }}>{ic[t.type]}</span>
                    <span className="toast-msg">{t.msg}</span>
                </div>
            ))}
        </div>
    );
}

// ── Stat card ────────────────────────────────────────────────
function StatCard({ label, value, icon, accent, loading, delay = 0 }) {
    const bgs = { '#3b82f6': '#eff6ff', '#10b981': '#ecfdf5', '#ef4444': '#fef2f2', '#f59e0b': '#fffbeb' };
    return (
        <div className="stat-card fu" style={{ borderTop: `3px solid ${accent}`, animationDelay: `${delay}ms` }}>
            <div className="stat-card-info">
                <div className="stat-label">
                    {loading ? <div className="sk" style={{ width: 60, height: 9 }}/> : label}
                </div>
                <div className="stat-value">
                    {loading ? <div className="sk" style={{ width: 50, height: 26, marginTop: 4 }}/> : value}
                </div>
            </div>
            <div className="stat-icon" style={{ background: loading ? '#f1f5f9' : bgs[accent] }}>
                {loading ? <div className="sk" style={{ width: 40, height: 40, borderRadius: 10 }}/> : icon}
            </div>
        </div>
    );
}

// ── Skeleton row ─────────────────────────────────────────────
function SkeletonRow() {
    return (
        <div className="skeleton-row">
            <div className="skeleton-row-top">
                <div className="sk" style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }}/>
                <div className="sk" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }}/>
                <div style={{ flex: 1 }}>
                    <div className="sk" style={{ width: '55%', height: 13, marginBottom: 6 }}/>
                    <div className="sk" style={{ width: '40%', height: 10 }}/>
                </div>
                <div className="sk" style={{ width: 48, height: 22, borderRadius: 99 }}/>
            </div>
            <div className="skeleton-actions">
                <div className="sk" style={{ width: 64, height: 30, borderRadius: 8 }}/>
                <div className="sk" style={{ width: 64, height: 30, borderRadius: 8 }}/>
            </div>
        </div>
    );
}

// ── Delete modal (bottom sheet) ───────────────────────────────
function DeleteModal({ state, onConfirm, onCancel }) {
    if (!state.open) return null;
    const { domain, messageIds, countLoading, deleteLoading, bulk, senders, totalCount, loading } = state;

    const isBulk = !!bulk;
    const phase = (isBulk ? loading : countLoading) ? 'counting'
        : deleteLoading ? 'deleting'
        : 'confirm';

    const emailCount = isBulk ? totalCount : (messageIds?.length || 0);
    const senderLabel = isBulk ? `${senders?.length} senders` : domain;

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
            <div className="modal-sheet">
                <div className="modal-handle"/>
                <button className="modal-close" onClick={onCancel}>✕</button>
                <h2 className="modal-title">{isBulk ? 'Bulk Delete' : 'Delete Emails'}</h2>

                {phase === 'counting' && (
                    <div className="modal-spinner-wrap">
                        <div className="modal-spinner"/>
                        <p className="modal-counting-text">
                            Counting emails from {senderLabel}…
                        </p>
                    </div>
                )}

                {phase === 'confirm' && (
                    <>
                        <div className="modal-count-box">
                            <div className="modal-count-num">{emailCount.toLocaleString()}</div>
                            <div className="modal-count-sub">emails from {senderLabel}</div>
                        </div>
                        <p className="modal-warning">⚠ This action cannot be undone.</p>
                        <button className="modal-btn-confirm" onClick={onConfirm}>
                            Delete {emailCount.toLocaleString()} Emails
                        </button>
                        <button className="modal-btn-cancel" onClick={onCancel}>Cancel</button>
                    </>
                )}

                {phase === 'deleting' && (
                    <div>
                        <p className="modal-counting-text" style={{ textAlign: 'center', marginBottom: 0 }}>
                            Deleting {emailCount.toLocaleString()} emails…
                        </p>
                        <div className="modal-progress-track">
                            <div className="modal-progress-fill"/>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main dashboard ────────────────────────────────────────────
function GmailSendersList({ searchQuery = '' }) {
    const accessToken = sessionStorage.getItem('googleAccessToken');
    const { toasts, add: addToast } = useToast();

    const {
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
    } = useGmailAnalysis(accessToken, addToast);

    const [page, setPage] = useState(1);
    const PER_PAGE = 10;

    // Sort by count desc, filter by search
    const sorted = useMemo(() => {
        return Object.entries(stage1SenderData)
            .map(([domain, data]) => [domain, data.total || 0])
            .sort((a, b) => b[1] - a[1]);
    }, [stage1SenderData]);

    const filtered = useMemo(() => {
        if (!searchQuery) return sorted;
        return sorted.filter(([d]) => d.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [sorted, searchQuery]);

    React.useEffect(() => { setPage(1); }, [searchQuery]);

    const totalPages = Math.ceil(filtered.length / PER_PAGE);
    const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const allOnPageSelected = paged.length > 0 && paged.every(([d]) => selectedSenders.has(d));
    const someOnPageSelected = paged.some(([d]) => selectedSenders.has(d));

    const handleSelectAll = useCallback(() => {
        setSelectedSenders(prev => {
            const next = new Set(prev);
            paged.forEach(([d]) => allOnPageSelected ? next.delete(d) : next.add(d));
            return next;
        });
    }, [paged, allOnPageSelected, setSelectedSenders]);

    const handleBulkFilter = useCallback(async () => {
        const arr = [...selectedSenders];
        let processed = 0;
        for (const domain of arr) {
            try {
                await handleAttemptUnsubscribe(domain);
                processed++;
            } catch (_) {}
        }
        setSelectedSenders(new Set());
    }, [selectedSenders, handleAttemptUnsubscribe, setSelectedSenders]);

    const handleBulkDelete = useCallback(() => {
        if (selectedSenders.size === 0) return;
        initiateBulkDelete(selectedSenders);
    }, [selectedSenders, initiateBulkDelete]);

    const handleIndividualDelete = useCallback(d => {
        if (isBatchProcessing || isDeleteInProgress) return;
        handleTrashAllFromSender(d);
    }, [isBatchProcessing, isDeleteInProgress, handleTrashAllFromSender]);

    // Combine delete modals — single sender uses deleteConfirmState, bulk uses bulkDeleteState
    const modalState = bulkDeleteState?.open
        ? { ...bulkDeleteState, bulk: true }
        : deleteConfirmState;

    const handleModalConfirm = bulkDeleteState?.open ? confirmBulkDelete : confirmDeleteAllFromSender;
    const handleModalCancel  = bulkDeleteState?.open ? cancelBulkDelete  : cancelDeleteAllFromSender;

    const hasSenders = filtered.length > 0;
    const showSkeletons = isLoading && sorted.length === 0;

    return (
        <div className="dashboard-root" style={{ paddingBottom: selectedSenders.size > 0 ? 100 : 0 }}>
            <Toasts toasts={toasts}/>
            <DeleteModal
                state={modalState || { open: false }}
                onConfirm={handleModalConfirm}
                onCancel={handleModalCancel}
            />

            <main className="dashboard-main">

                {/* Progress bar */}
                {isLoading && (
                    <div className="progress-card fu">
                        <div className="progress-card-header">
                            <span className="progress-label">{progress || 'Analyzing emails…'}</span>
                            <span className="progress-pct">{progressPct}%</span>
                        </div>
                        <div className="progress-track">
                            <div className="progress-fill" style={{ width: `${progressPct}%` }}/>
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && !isLoading && (
                    <div className="error-card">
                        <p className="error-msg">{error}</p>
                        <button className="btn-retry" onClick={performStage1Analysis}>Retry Analysis</button>
                    </div>
                )}

                {/* Stat cards */}
                <div className="stats-grid">
                    <StatCard label="Senders"  value={sorted.length}                   icon="👥" accent="#3b82f6" loading={isLoading && sorted.length === 0} delay={0}/>
                    <StatCard label="Scanned"  value={fmt(totalEmailsScanned)}          icon="✉️" accent="#10b981" loading={isLoading && totalEmailsScanned === 0} delay={50}/>
                    <StatCard label="Filtered" value={existingFilters.size}             icon="🚫" accent="#ef4444" loading={false} delay={100}/>
                    <StatCard label="Deleted"  value={fmt(totalEmailsDeleted)}          icon="🗑️" accent="#f59e0b" loading={false} delay={150}/>
                </div>

                {/* Sender list */}
                <div className="senders-card">
                    {/* Header */}
                    <div className="senders-card-header">
                        <input type="checkbox"
                            checked={allOnPageSelected}
                            ref={el => { if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected; }}
                            onChange={handleSelectAll}
                            style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span className="senders-card-header-label">EMAIL SENDERS</span>
                        {selectedSenders.size > 0 && (
                            <span className="sel-badge">{selectedSenders.size} selected</span>
                        )}
                        <span className="total-count">{filtered.length} total</span>
                    </div>

                    {/* Empty state */}
                    {!hasSenders && !showSkeletons && !isLoading && (
                        <div className="empty-state">
                            <div className="empty-icon">📭</div>
                            <p className="empty-title">{searchQuery ? 'No senders found' : 'No data yet'}</p>
                            <p className="empty-sub">{searchQuery ? 'Try a different search' : 'Analysis complete or retry above'}</p>
                        </div>
                    )}

                    {/* Skeletons */}
                    {showSkeletons && [0,1,2,3].map(i => <SkeletonRow key={i}/>)}

                    {/* Rows */}
                    {paged.map(([domain, count]) => (
                        <SenderRow
                            key={domain}
                            domain={domain}
                            count={count}
                            isFiltered={existingFilters.has(domain)}
                            isUnsubbing={unsubscribeState.isLoading && unsubscribeState.senderDomain === domain}
                            selected={selectedSenders.has(domain)}
                            onToggle={() => {
                                setSelectedSenders(prev => {
                                    const n = new Set(prev);
                                    n.has(domain) ? n.delete(domain) : n.add(domain);
                                    return n;
                                });
                            }}
                            onFilter={() => handleAttemptUnsubscribe(domain)}
                            onDelete={() => handleIndividualDelete(domain)}
                            isDeleting={isDeleteInProgress && deleteConfirmState?.domain === domain}
                            disableDelete={isDeleteInProgress || isBatchProcessing}
                        />
                    ))}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pagination-bar">
                            <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                                <ChevronL/> Prev
                            </button>
                            <span className="pagination-counter">{page} / {totalPages}</span>
                            <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                                Next <ChevronR/>
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {/* Fixed bulk action bar */}
            {selectedSenders.size > 0 && (
                <div className="bulk-bar">
                    <div className="bulk-bar-inner">
                        <div className="bulk-bar-meta">
                            <span className="bulk-sel-count">
                                <strong>{selectedSenders.size}</strong> selected
                            </span>
                            <button className="bulk-clear-btn" onClick={() => setSelectedSenders(new Set())}>
                                Clear
                            </button>
                        </div>
                        <div className="bulk-actions-grid">
                            <button className="bulk-btn-filter" onClick={handleBulkFilter}>
                                🚫 Filter ({selectedSenders.size})
                            </button>
                            <button className="bulk-btn-delete" onClick={handleBulkDelete}>
                                🗑️ Delete ({selectedSenders.size})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Sender row (extracted for clarity) ───────────────────────
function SenderRow({ domain, count, isFiltered, isUnsubbing, selected, onToggle, onFilter, onDelete, isDeleting, disableDelete }) {
    const [hovered, setHovered] = useState(false);
    const cls = ['sender-row', selected ? 'selected' : '', hovered && !selected ? 'hovered' : ''].filter(Boolean).join(' ');

    return (
        <div className={cls}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}>
            <div className="sender-row-top">
                <input type="checkbox" checked={selected} onChange={onToggle}
                    style={{ width: 18, height: 18, accentColor: 'var(--primary)', flexShrink: 0, cursor: 'pointer' }}/>
                <div className="sender-avatar" style={{ background: avatarColor(domain) }}>
                    {domain[0].toUpperCase()}
                </div>
                <div className="sender-info">
                    <div className="sender-domain">{domain}</div>
                    <div className="sender-email">@{domain}</div>
                </div>
                <div className="count-pill">{fmt(count)}</div>
            </div>
            <div className="sender-actions">
                {isFiltered
                    ? <span className="filtered-badge">✓ Filtered</span>
                    : <button className="btn-filter" onClick={onFilter} disabled={isUnsubbing}>
                        {isUnsubbing ? '…' : 'Filter'}
                    </button>
                }
                <button className="btn-delete" onClick={onDelete} disabled={disableDelete}>
                    {isDeleting ? '…' : 'Delete'}
                </button>
            </div>
        </div>
    );
}

export default GmailSendersList;
