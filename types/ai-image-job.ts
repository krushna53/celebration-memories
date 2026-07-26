export type AiImageJobStatus = "pending" | "processing" | "done" | "error";

/** Client-safe shape returned by getAiImageJobStatusAction while polling. */
export interface AiImageJobRecord {
  id: string;
  status: AiImageJobStatus;
  resultUrl: string | null;
  resultPath: string | null;
  errorMessage: string | null;
}
