// src/types/unzipper.d.ts
declare module "unzipper" {
  export interface Entry {
    path: string;
    buffer(): Promise<Buffer>;
  }

  export interface CentralDirectory {
    files: Entry[];
  }

  export function OpenResponse(response: Response): Promise<CentralDirectory>;
  export const Open: {
    response(response: Response): Promise<CentralDirectory>;
  };
}