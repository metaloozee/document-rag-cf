import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Chat } from "@/components/chat/chat";
import { auth } from "@/lib/auth";

export default async function ProjectPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  return <Chat />;
}
