import { redirect } from "next/navigation";
import { requireAuth } from "@/server/auth";
import { createDraftReport } from "@/server/services/reports";

export default async function NewReportPage() {
  const session = await requireAuth();
  const report = await createDraftReport(session.user.id);

  redirect(`/reports/${report.id}/wizard/info`);
}
