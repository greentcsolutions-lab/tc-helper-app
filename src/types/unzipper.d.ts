// src/types/unzipper.d.ts
// TypeScript declarations for unzipper@0.10.11 (confirmed API support for Response/stream)
// Covers Open.response, Parse, Entry, Directory — no @types package exists

declare module "unzipper" {
  import { Readable } from "stream";

  export interface Entry {
    path: string;
    type: string;
    buffer(password?: string): Promise<Buffer>;
    stream(password?: string): Readable;
    autodrain(): void;
    extract(options?: { path?: string; concurrency?: number }): void;
  }

  export interface Directory {
    files: Entry[];
    extract(options?: { path?: string; concurrency?: number }): void;
  }

  export namespace Open {
    function response(response: Response, options?: any): Promise<Directory>;
    function buffer(buffer: Buffer, options?: any): Promise<Directory>;
    function file(path: string, options?: any): Promise<Directory>;
    function url(requestLib: any, url: string, options?: any): Promise<Directory>;
    function custom(source: any, options?: any): Promise<Directory>;
  }

  export function Parse(options?: { stream?: Readable; filter?: (entry: Entry) => boolean }): any; // Returns parser stream
  export function ParseOne(filename: RegExp | string): any; // Convenience for single file
  export function Extract(options?: { path?: string; concurrency?: number }): any; // Extract stream

  export namespace Parse {
    function promise(parser: any): Promise<void>; // For async completion
  }
}