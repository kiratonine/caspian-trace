import { createHash } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { load, type CheerioAPI } from 'cheerio'

import type { PlatformEnvironment } from '../../config/environment'
import { publicIngestionError } from '../ingestion.errors'
import {
  ATYRAU_GEOGRAPHY_TERMS,
  ATYRAU_REGION_MARKERS,
  MANGYSTAU_GEOGRAPHY_TERMS,
  MANGYSTAU_REGION_MARKERS,
  POLLUTION_TERMS,
} from '../gdelt/gdelt-query'
import type { KazhydrometRegion } from '../ingestion.types'
import type { ArticleExtractionResult } from './article.types'

const REMOVED_ELEMENTS = 'script,style,noscript,svg,canvas,form,nav,header,footer,aside,iframe'
const BODY_SELECTORS = ['[itemprop="articleBody"]', 'article', 'main', 'body'] as const
const MINIMUM_TEXT_CHARS = 20

@Injectable()
export class ArticleTextService {
  private readonly maximumTextChars: number

  constructor(config: ConfigService<PlatformEnvironment, true>) {
    this.maximumTextChars = config.getOrThrow('DIRECT_SOURCE_TEXT_MAX_CHARS')
  }

  extract(
    bytes: Buffer,
    discoveryTitle: string | null,
    requestedRegions: readonly KazhydrometRegion[],
    now: Date,
  ): ArticleExtractionResult {
    let html: string
    try {
      html = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      throw publicIngestionError('PUBLIC_ARTICLE_TEXT_INVALID', 'Public article is not valid UTF-8')
    }
    const $ = load(html)
    const title = extractTitle($, discoveryTitle)
    const publication = extractPublishedAt($, now)
    $(REMOVED_ELEMENTS).remove()
    const text = extractBody($)
    if (text.length < MINIMUM_TEXT_CHARS) {
      throw publicIngestionError('PUBLIC_ARTICLE_TEXT_EMPTY', 'Public article text is empty')
    }
    if (text.length > this.maximumTextChars) {
      throw publicIngestionError('PUBLIC_ARTICLE_TEXT_TOO_LARGE', 'Public article text exceeds the configured limit')
    }
    const searchable = `${title.value ?? ''}\n${text}`.toLocaleLowerCase('ru')
    const geography = uniqueMatches(searchable, [...ATYRAU_GEOGRAPHY_TERMS, ...MANGYSTAU_GEOGRAPHY_TERMS])
    const matchedRequestedRegions = requestedRegions.filter((region) =>
      uniqueMatches(
        searchable,
        region === 'atyrau' ? ATYRAU_REGION_MARKERS : MANGYSTAU_REGION_MARKERS,
      ).length > 0,
    )
    const pollution = uniqueMatches(searchable, POLLUTION_TERMS)
    return {
      title: title.value,
      publishedAt: publication.value,
      text,
      textSha256: createHash('sha256').update(text).digest('hex'),
      textChars: text.length,
      titleMode: title.mode,
      publishedAtMode: publication.mode,
      matchedGeographyKeywords: geography,
      matchedRequestedRegions,
      matchedPollutionKeywords: pollution,
      relevant: matchedRequestedRegions.length > 0 && pollution.length > 0,
    }
  }
}

function extractTitle($: CheerioAPI, discoveryTitle: string | null): {
  value: string | null
  mode: ArticleExtractionResult['titleMode']
} {
  const candidates: Array<[ArticleExtractionResult['titleMode'], string | undefined]> = [
    ['og_title', $('meta[property="og:title"]').first().attr('content')],
    ['twitter_title', $('meta[name="twitter:title"]').first().attr('content')],
    ['document_title', $('title').first().text()],
    ['discovery', discoveryTitle ?? undefined],
  ]
  for (const [mode, value] of candidates) {
    const normalized = normalizeSingleLine(value ?? '')
    if (normalized.length > 0 && normalized.length <= 500) return { value: normalized, mode }
  }
  return { value: null, mode: 'none' }
}

function extractPublishedAt($: CheerioAPI, now: Date): {
  value: string | null
  mode: ArticleExtractionResult['publishedAtMode']
} {
  const groups: Array<[ArticleExtractionResult['publishedAtMode'], string[]]> = [
    ['article_published_time', $('meta[property="article:published_time"]').map((_index, element) => $(element).attr('content') ?? '').get()],
    ['json_ld', jsonLdDates($)],
    ['time_datetime', $('article time[datetime], [itemprop="articleBody"] time[datetime], main time[datetime]').map((_index, element) => $(element).attr('datetime') ?? '').get()],
  ]
  for (const [mode, values] of groups) {
    const accepted = [...new Set(values.map((value) => exactIso(value, now)).filter((value): value is string => value !== null))]
    if (accepted.length === 1) return { value: accepted[0]!, mode }
    if (accepted.length > 1) return { value: null, mode: 'none' }
  }
  return { value: null, mode: 'none' }
}

function jsonLdDates($: CheerioAPI): string[] {
  const dates: string[] = []
  $('script[type="application/ld+json"]').each((_index, element) => {
    try {
      collectDatePublished(JSON.parse($(element).text()) as unknown, dates, 0)
    } catch {
      // Malformed optional JSON-LD does not invalidate otherwise source-derived HTML.
    }
  })
  return dates
}

function collectDatePublished(value: unknown, output: string[], depth: number): void {
  if (depth > 5 || value === null || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 50)) collectDatePublished(item, output, depth + 1)
    return
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === 'datePublished' && typeof item === 'string') output.push(item)
    else collectDatePublished(item, output, depth + 1)
  }
}

function exactIso(value: string, now: Date): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime()) || parsed.getTime() > now.getTime() + 86_400_000) return null
  return parsed.toISOString()
}

function extractBody($: CheerioAPI): string {
  for (const selector of BODY_SELECTORS) {
    const element = $(selector).first()
    if (element.length === 0) continue
    const blocks = element.find('p,h1,h2,h3,h4,li,blockquote').map((_index, child) => normalizeSingleLine($(child).text())).get().filter(Boolean)
    const text = normalizeParagraphs(blocks.length > 0 ? blocks.join('\n') : element.text())
    if (text.length >= MINIMUM_TEXT_CHARS) return text
  }
  return ''
}

function normalizeSingleLine(value: string): string {
  return value.replace(/[\t\f\v\u00a0 ]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim()
}

function normalizeParagraphs(value: string): string {
  return value.split(/\r?\n/).map(normalizeSingleLine).filter(Boolean).join('\n').trim()
}

function uniqueMatches(haystack: string, terms: readonly string[]): string[] {
  return [...new Set(terms.filter((term) => haystack.includes(term.toLocaleLowerCase('ru'))))]
}
