import type {
  StoredSnapshot,
  UploadImmutableSnapshotInput,
} from './storage.types'

export interface SourceStoragePort {
  uploadImmutableSnapshot(
    input: UploadImmutableSnapshotInput,
  ): Promise<StoredSnapshot>

  createSignedReadUrl(path: string, expiresInSeconds: number): Promise<string>

  exists(path: string): Promise<boolean>

  download(path: string): Promise<Buffer>
}

