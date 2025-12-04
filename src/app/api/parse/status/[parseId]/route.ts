// src/app/api/parse/status/[parseId]/route.ts
import { uploadProgress } from "@/lib/progress";

export async function GET(
  request: Request,
  { params }: { params: { parseId: string } }
) {
  const { parseId } = params;

  const updates = uploadProgress.get(parseId) || [];

  const isDone = updates.some(msg => 
    msg.message.includes("ready!") || msg.message.includes("Saved to database")
  );

  return Response.json({
    messages: updates.map(u => u.message),
    done: isDone,
    hasUpdates: updates.length > 0,
  });
}