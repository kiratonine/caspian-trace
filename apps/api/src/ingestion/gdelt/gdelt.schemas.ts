import { z } from 'zod'

export const GdeltArticleSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  seendate: z.string().optional(),
  domain: z.string().optional(),
  language: z.string().optional(),
  sourcecountry: z.string().optional(),
}).passthrough()

export const GdeltResponseSchema = z.object({
  articles: z.array(z.unknown()).max(100),
}).passthrough()

export type GdeltArticle = z.infer<typeof GdeltArticleSchema>
export type GdeltResponse = z.infer<typeof GdeltResponseSchema>
