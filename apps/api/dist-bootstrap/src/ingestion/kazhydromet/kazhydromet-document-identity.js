"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSourceDocumentIdentity = buildSourceDocumentIdentity;
exports.buildDocumentId = buildDocumentId;
const node_crypto_1 = require("node:crypto");
const PUBLISHER = 'РГП «Казгидромет»';
function buildSourceDocumentIdentity(snapshot) {
    const candidate = snapshot.candidate;
    const regions = [...candidate.regions].sort();
    const id = buildDocumentId(snapshot);
    return {
        id,
        originalUrl: candidate.canonicalUrl,
        canonicalUrl: canonicalizeSnapshotUrl(snapshot.finalUrl),
        publisher: PUBLISHER,
        title: sourceTitle(candidate.anchorText, candidate.contextText, candidate.publishedPeriod, regions),
        sourceType: 'kazhydromet_bulletin',
        mediaType: 'application/pdf',
        publishedPeriod: candidate.publishedPeriod,
        sha256: snapshot.sha256,
        extractionMetadata: {
            kazhydrometDiscovery: {
                listingUrl: candidate.listingUrl,
                discoveryMode: candidate.discoveryMode,
                regions,
                language: candidate.language,
            },
        },
    };
}
function buildDocumentId(snapshot) {
    const { candidate } = snapshot;
    if (candidate.regions.length === 1 &&
        candidate.regions[0] === 'atyrau' &&
        candidate.language === 'ru' &&
        candidate.publishedPeriod !== null) {
        return `doc-kazhydromet-${candidate.publishedPeriod}`;
    }
    const urlHash = sha(snapshot.finalUrl);
    if (candidate.regions.length === 1 && candidate.publishedPeriod !== null) {
        return `doc-kazhydromet-${candidate.regions[0]}-${candidate.publishedPeriod}-${urlHash.slice(0, 8)}`;
    }
    return `doc-kazhydromet-${urlHash.slice(0, 16)}-${snapshot.sha256.slice(0, 12)}`;
}
function canonicalizeSnapshotUrl(value) {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
}
function sourceTitle(anchorText, contextText, period, regions) {
    const sourceText = anchorText || contextText;
    if (sourceText.length > 0)
        return sourceText.slice(0, 500);
    return `Экологический бюллетень Казгидромета${regions.length > 0 ? `: ${regions.join(', ')}` : ''}${period ? `, ${period}` : ''}`;
}
function sha(value) {
    return (0, node_crypto_1.createHash)('sha256').update(value).digest('hex');
}
//# sourceMappingURL=kazhydromet-document-identity.js.map