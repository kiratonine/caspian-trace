import type { Server } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { HealthReadySchema } from '@caspian-trace/contracts'

import { AppModule } from '../src/app.module'
import { configureApplication } from '../src/config/application.setup'
import { PrismaService } from '../src/prisma/prisma.service'

describe('Supabase readiness (read-only e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let httpServer: Server

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication({ bodyParser: false })
    configureApplication(app)
    await app.init()
    prisma = app.get(PrismaService)
    httpServer = app.getHttpServer() as Server
  })

  afterAll(async (): Promise<void> => {
    await app.close()
  })

  it('uses the runtime connection for HTTP readiness', async () => {
    const response = await request(httpServer).get('/api/health/ready').expect(200)
    expect(HealthReadySchema.parse(response.body).database).toBe('ready')
  })

  it('sees applied Part 02 migrations, RLS, and provenance constraints', async () => {
    const migrations = await prisma.$queryRaw<
      Array<{ migration_name: string }>
    >`SELECT migration_name
      FROM "_prisma_migrations"
      WHERE migration_name IN (
        '20260804000000_initial_schema',
        '20260804160000_harden_provenance'
      )
        AND finished_at IS NOT NULL
        AND rolled_back_at IS NULL
      ORDER BY migration_name`
    const rls = await prisma.$queryRaw<Array<{ enabled_count: bigint }>>`
      SELECT count(*) AS enabled_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    `
    const constraints = await prisma.$queryRaw<
      Array<{ column_count: number; confdeltype: string; conname: string }>
    >`SELECT
        conname,
        confdeltype::text,
        cardinality(conkey)::integer AS column_count
      FROM pg_constraint
      WHERE conname IN (
        'measurements_source_document_id_fkey',
        'measurements_source_page_id_source_document_id_fkey',
        'incident_signals_source_document_id_fkey',
        'candidate_object_sources_source_document_id_fkey'
      )
      ORDER BY conname`

    expect(migrations).toEqual([
      { migration_name: '20260804000000_initial_schema' },
      { migration_name: '20260804160000_harden_provenance' },
    ])
    expect(rls[0]?.enabled_count).toBeGreaterThanOrEqual(21n)
    expect(constraints).toEqual([
      {
        column_count: 1,
        confdeltype: 'r',
        conname: 'candidate_object_sources_source_document_id_fkey',
      },
      {
        column_count: 1,
        confdeltype: 'r',
        conname: 'incident_signals_source_document_id_fkey',
      },
      {
        column_count: 1,
        confdeltype: 'r',
        conname: 'measurements_source_document_id_fkey',
      },
      {
        column_count: 2,
        confdeltype: 'r',
        conname: 'measurements_source_page_id_source_document_id_fkey',
      },
    ])
  })
})
