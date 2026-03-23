export {}

type AsyncImportModule = unknown

declare global {
  function AsyncImport<TModule = AsyncImportModule>(path: string): Promise<TModule>
}
