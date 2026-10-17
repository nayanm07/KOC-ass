import { redirect } from "next/navigation";

// middleware.ts sends users to their role's home; this is only a fallback
export default function Home() {
  redirect("/login");
}
