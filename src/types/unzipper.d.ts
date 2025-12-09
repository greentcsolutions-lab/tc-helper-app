// src/types/unzipper.d.ts
// TypeScript declaration for unzipper@0.10.11 (no official @types exist)
// This removes the last "implicitly any" error forever

declare module "unzipper" {
  export interface Entry {
    path: string;
    type: string;
    buffer(): Promise<Buffer>;
  }

  export interface CentralDirectory {
    files: Entry[];
  }

  export namespace Open {
    export function buffer(buffer: Buffer): Promise<CentralDirectory>;
    export function file(filename: string): Promise<CentralDirectory>;
    export function url(url: string): Promise<CentralDirectory>;
  }

  export function Parse(options?: { stream: NodeJS.ReadableStream }): any;
}