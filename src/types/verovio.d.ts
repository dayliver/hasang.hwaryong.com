declare module 'verovio/wasm' {
  export default function createVerovioModule(): Promise<object>
}

declare module 'verovio/esm' {
  export class VerovioToolkit {
    constructor(module: object)
    setOptions(options: Record<string, unknown>): void
    loadData(data: string): boolean | number
    loadZipDataBuffer(data: ArrayBuffer): boolean | number
    getMEI(options?: Record<string, unknown>): string
    getPageCount(): number
    renderToSVG(pageNo?: number, xmlDeclaration?: boolean): string
    destroy(): void
  }
}
