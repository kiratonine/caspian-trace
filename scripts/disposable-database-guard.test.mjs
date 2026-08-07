import assert from 'node:assert/strict'
import test from 'node:test'

import { assertDisposableDatabaseTarget } from './disposable-database-guard.mjs'

test('rejects Supabase-like runtime and direct URLs before a connection', () => {
  let connectionAttempted = false
  const localUrl =
    'postgresql://placeholder:placeholder@127.0.0.1:5432/test'
  for (const target of [
    {
      databaseUrl:
        'postgresql://placeholder:placeholder@project.supabase.co:5432/postgres',
      directUrl: localUrl,
    },
    {
      databaseUrl: localUrl,
      directUrl:
        'postgresql://placeholder:placeholder@aws-0-region.pooler.supabase.com:5432/postgres',
    },
  ]) {
    assert.throws(
      () => {
        assertDisposableDatabaseTarget({
          ...target,
          explicitlyDisposable: true,
        })
        connectionAttempted = true
      },
      /Supabase targets are forbidden/,
    )
  }
  assert.equal(connectionAttempted, false)
})

test('requires an explicit disposable confirmation', () => {
  assert.throws(
    () =>
      assertDisposableDatabaseTarget({
        databaseUrl: 'postgresql://placeholder:placeholder@127.0.0.1:5432/test',
        directUrl: 'postgresql://placeholder:placeholder@127.0.0.1:5432/test',
        explicitlyDisposable: false,
      }),
    /Explicit disposable database confirmation is required/,
  )
})

test('accepts an explicitly disposable non-Supabase PostgreSQL target', () => {
  assert.doesNotThrow(() =>
    assertDisposableDatabaseTarget({
      databaseUrl: 'postgresql://placeholder:placeholder@127.0.0.1:5432/test',
      directUrl: 'postgresql://placeholder:placeholder@127.0.0.1:5432/test',
      explicitlyDisposable: true,
    }),
  )
})
