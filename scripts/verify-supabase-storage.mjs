import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

const requireFromApi = createRequire(
  new URL('../apps/api/package.json', import.meta.url),
)
const { createClient } = requireFromApi('@supabase/supabase-js')

const requiredKeys = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SOURCE_BUCKET',
]
for (const key of requiredKeys) {
  if (!process.env[key]) throw new Error(`Missing required environment key: ${key}`)
}

const supabaseUrl = parseHttpsUrl(process.env.SUPABASE_URL)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const bucketName = validateBucketName(process.env.SUPABASE_SOURCE_BUCKET)
const maxBytes = parseInteger(
  process.env.HTTP_MAX_BYTES ?? '15728640',
  'HTTP_MAX_BYTES',
  1,
  15_728_640,
)
const configuredTtl = parseInteger(
  process.env.SOURCE_SIGNED_URL_TTL_SECONDS ?? '120',
  'SOURCE_SIGNED_URL_TTL_SECONDS',
  30,
  600,
)
const signedTtl = Math.min(configuredTtl, 120)

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

const bucketResult = await client.storage.getBucket(bucketName)
if (bucketResult.error || !bucketResult.data) {
  throw new Error('SUPABASE_SOURCE_BUCKET_NOT_FOUND')
}
if (bucketResult.data.public !== false) {
  throw new Error('SUPABASE_SOURCE_BUCKET_MUST_BE_PRIVATE')
}
if (
  typeof bucketResult.data.file_size_limit === 'number' &&
  bucketResult.data.file_size_limit < maxBytes
) {
  throw new Error('Supabase source bucket file size limit is too small')
}

const bytes = Buffer.from(`caspian-trace Part 05 smoke ${randomUUID()}\n`)
const sha256 = createHash('sha256').update(bytes).digest('hex')
const path = `smoke-tests/part05/${randomUUID()}/${sha256}.txt`
let uploaded = false
let failure

try {
  const firstUpload = await client.storage.from(bucketName).upload(path, bytes, {
    contentType: 'text/plain',
    upsert: false,
    cacheControl: '31536000',
    metadata: { sha256, purpose: 'part05-storage-smoke' },
  })
  if (firstUpload.error) throw new Error('Storage smoke upload failed')
  uploaded = true

  const duplicate = await client.storage.from(bucketName).upload(path, bytes, {
    contentType: 'text/plain',
    upsert: false,
    cacheControl: '31536000',
  })
  if (!duplicate.error) {
    throw new Error('Storage accepted an immutable duplicate overwrite')
  }

  const signed = await client.storage
    .from(bucketName)
    .createSignedUrl(path, signedTtl)
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error('Storage signed URL creation failed')
  }
  const signedUrl = new URL(signed.data.signedUrl)
  if (signedUrl.protocol !== 'https:') throw new Error('Signed URL is not HTTPS')

  const response = await fetch(signedUrl, { cache: 'no-store' })
  if (!response.ok) throw new Error('Signed Storage download failed')
  const downloaded = Buffer.from(await response.arrayBuffer())
  const downloadedSha = createHash('sha256').update(downloaded).digest('hex')
  if (downloadedSha !== sha256 || !downloaded.equals(bytes)) {
    throw new Error('Signed Storage download failed SHA verification')
  }
} catch (error) {
  failure = error
} finally {
  if (uploaded) {
    const removed = await client.storage.from(bucketName).remove([path])
    if (removed.error) {
      failure ??= new Error('Storage smoke cleanup failed')
    } else {
      const absent = await client.storage.from(bucketName).download(path)
      if (!absent.error) {
        failure ??= new Error('Storage smoke object still exists after cleanup')
      }
    }
  }
}

if (failure) throw failure
console.log('Private Supabase Storage immutable upload/signed-read/cleanup smoke passed')

function parseHttpsUrl(value) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('Invalid environment key: SUPABASE_URL')
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Invalid environment key: SUPABASE_URL')
  }
  return parsed.toString()
}

function validateBucketName(value) {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(value)) {
    throw new Error('Invalid environment key: SUPABASE_SOURCE_BUCKET')
  }
  return value
}

function parseInteger(value, key, minimum, maximum) {
  if (!/^\d+$/.test(value)) throw new Error(`Invalid environment key: ${key}`)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Invalid environment key: ${key}`)
  }
  return parsed
}
