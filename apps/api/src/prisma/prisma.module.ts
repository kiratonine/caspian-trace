import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'

import { PRISMA_ADAPTER_FACTORY } from './prisma.constants'
import { normalizePgConnectionString } from './prisma-connection'
import { PrismaService, type PrismaAdapterFactory } from './prisma.service'

const prismaAdapterFactory: PrismaAdapterFactory = (
  databaseUrl,
  connectionTimeoutMillis,
) =>
  new PrismaPg({
    connectionString: normalizePgConnectionString(databaseUrl),
    connectionTimeoutMillis,
  })

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    PrismaService,
    { provide: PRISMA_ADAPTER_FACTORY, useValue: prismaAdapterFactory },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
