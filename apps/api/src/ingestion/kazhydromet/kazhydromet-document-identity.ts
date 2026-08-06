import { createHash } from 'node:crypto'

import type { SourceDocumentIdentityInput } from '../ingestion.types'
import type { KazhydrometRawSnapshot } from './kazhydromet.types'

const PUBLISHER = 'РГП «Казгидромет»'

export function buildSourceDocumentIdentity(
  snapshot: KazhydrometRawSnapshot,
): SourceDocumentIdentityInput {
  const candidate = snapshot.candidate
  const regions = [...candidate.regions].sort()
  const id = buildDocumentId(snapshot)
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
  }
}

export function buildDocumentId(snapshot: KazhydrometRawSnapshot): string {
  const { candidate } = snapshot
  if (
    candidate.regions.length === 1 &&
    candidate.regions[0] === 'atyrau' &&
    candidate.language === 'ru' &&
    candidate.publishedPeriod !== null
  ) {
    return `doc-kazhydromet-${candidate.publishedPeriod}`
  }
  const urlHash = sha(snapshot.finalUrl)
  if (candidate.regions.length === 1 && candidate.publishedPeriod !== null) {
    return `doc-kazhydromet-${candidate.regions[0]}-${candidate.publishedPeriod}-${urlHash.slice(0, 8)}`
  }
  return `doc-kazhydromet-${urlHash.slice(0, 16)}-${snapshot.sha256.slice(0, 12)}`
}

function canonicalizeSnapshotUrl(value: string): string {
  const url = new URL(value)
  url.hash = ''
  return url.toString()
}

function sourceTitle(
  anchorText: string,
  contextText: string,
  period: string | null,
  regions: string[],
): string {
  const sourceText = anchorText || contextText
  if (sourceText.length > 0) return sourceText.slice(0, 500)
  return `Экологический бюллетень Казгидромета${regions.length > 0 ? `: ${regions.join(', ')}` : ''}${period ? `, ${period}` : ''}`
}

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
