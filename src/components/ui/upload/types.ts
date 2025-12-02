// src/components/upload/types.ts
export type UploadView = "idle" | "uploading" | "preview" | "processing" | "extracting" | "done";

export type PreviewPage = {
  pageNumber: number;
  base64: string;
};