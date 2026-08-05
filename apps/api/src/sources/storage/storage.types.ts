export type SupportedSourceMediaType =
  keyof typeof import('./storage.constants').SOURCE_MEDIA_EXTENSIONS

export interface UploadImmutableSnapshotInput {
  path: string
  bytes: Buffer
  mediaType: SupportedSourceMediaType
  sha256: string
  sourceDocumentId: string
}

export interface StoredSnapshot {
  path: string
  sha256: string
  created: boolean
}

