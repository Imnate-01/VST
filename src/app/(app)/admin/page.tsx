import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/auth";

export default async function AdminPage() {
  await requireAdmin();
  redirect("/dashboard");
}
