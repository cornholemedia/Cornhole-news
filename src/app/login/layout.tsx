import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Log in",
  description: "Log in to Cornhole News to vote, comment, and submit stories.",
  path: "/login",
  noIndex: true,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
