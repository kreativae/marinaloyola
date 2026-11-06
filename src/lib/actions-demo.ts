"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createDemoData, removeDemoData } from "@/lib/demo-data";

async function requireDemoAccess() {
  const user = await requireAdmin();
  return user.role === "admin" || user.role === "manager" ? user : null;
}

export async function addDemoDataAction(): Promise<{ error?: string }> {
  const user = await requireDemoAccess();
  if (!user) return { error: "Sem permissão." };
  if (!(await createDemoData(user.id))) return { error: "Os dados de demonstração já foram adicionados." };
  revalidatePath("/admin", "layout");
  return {};
}

export async function removeDemoDataAction(): Promise<{ error?: string; kept?: number }> {
  if (!(await requireDemoAccess())) return { error: "Sem permissão." };
  const r = await removeDemoData();
  if (!r) return { error: "Não há dados de demonstração para excluir." };
  revalidatePath("/admin", "layout");
  return { kept: r.kept };
}
