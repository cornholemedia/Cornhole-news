import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Set a new password",
  description: "Choose a new password for your Cornhole News account.",
  path: "/reset-password",
  noIndex: true,
});

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
