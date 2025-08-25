// src/logic/sendersPipeline.js
// Pure helpers and the processing pipeline for the Gmail senders list.

export const stringToColor = (str) => {
    // Generate a stable HSL color from an input string.
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    const hue = Math.abs(hash) % 360;
    const saturation = 30;
    const lightness = 40;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

export const getPaginationItems = (currentPage, totalPages) => {
    if (totalPages <= 5) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const first = 1;
    const last = totalPages;

    if (currentPage === first) {
        return [first, first + 1, last];
    }

    if (currentPage === last) {
        return [first, last - 1, last];
    }

    const items = [first];

    // Always place current immediately after 1 (no left-side ellipsis)
    if (currentPage !== first) {
        if (currentPage === first + 1) {
            items.push(first + 1);
        } else {
            items.push(currentPage);
        }
    }

    // gap between current and last
    if (last - currentPage > 1) {
        if (last - currentPage === 2) {
            items.push(last - 1);
        } else {
            items.push('...');
        }
    }

    items.push(last);
    return items;
};

export function processSenders(stage1SenderData = {}, currentPage = 1, sendersPerPage = 10) {
    const entries = Object.entries(stage1SenderData || {});
    const sortedStage1DisplayData = entries.sort((a, b) => {
        const totalA = a[1].total || 0;
        const totalB = b[1].total || 0;
        return totalB - totalA;
    });

    const totalPages = Math.ceil(sortedStage1DisplayData.length / sendersPerPage) || 0;

    const paginatedSenders = sortedStage1DisplayData.slice(
        (currentPage - 1) * sendersPerPage,
        currentPage * sendersPerPage
    );

    return { sortedStage1DisplayData, paginatedSenders, totalPages };
}
