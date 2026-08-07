import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'
import { z } from 'zod'

import { PrismaClient } from '../src/generated/prisma/client'
import { normalizePgConnectionString } from '../src/prisma/prisma-connection'
import { loadVerifiedData } from './seed/verified-data.loader'
import { assertHumanReviewComplete } from './seed/verified-data.policy'
import { VerifiedSeedError } from './seed/verified-seed.errors'
import { seedVerifiedData } from './seed/verified-seed.service'

async function main(): Promise<void> {
  const validateOnly = parseArguments(process.argv.slice(2))
  const data = await loadVerifiedData()

  if (validateOnly) {
    console.log(
      JSON.stringify({
        structure: 'valid',
        documents: data.documents.length,
        measurements: data.measurements.length,
        relations: data.relations.length,
        humanReviewComplete: data.humanReview.complete,
        humanReviewers: `${data.humanReview.completed}/${data.humanReview.required}`,
        databaseWrites: 0,
      }),
    )
    return
  }

  // The gate intentionally precedes DATABASE_URL validation and client creation.
  assertHumanReviewComplete(data.humanReview)
  const databaseUrl = z
    .url({ protocol: /^postgres(?:ql)?$/ })
    .parse(process.env.DATABASE_URL)
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: normalizePgConnectionString(databaseUrl),
    }),
  })
  try {
    const summary = await seedVerifiedData(prisma, data)
    console.log(JSON.stringify(summary))
  } finally {
    await prisma.$disconnect()
  }
}

function parseArguments(args: string[]): boolean {
  const unsupported = args.filter((argument) => argument !== '--validate-only')
  if (unsupported.length > 0) {
    throw new VerifiedSeedError(
      'VERIFIED_DATA_SCHEMA_INVALID',
      'Only --validate-only is supported',
    )
  }
  return args.includes('--validate-only')
}

void main().catch((error: unknown) => {
  if (error instanceof VerifiedSeedError) {
    console.error(`${error.code}: ${error.message}`)
  } else if (error instanceof z.ZodError) {
    console.error('VERIFIED_DATA_SCHEMA_INVALID: DATABASE_URL is invalid')
  } else {
    console.error('VERIFIED_SEED_FAILED: Verified seed failed')
  }
  process.exitCode = 1
})
