import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Forgot password",
  description: "Request a password reset email for your Cornhole News account.",
  path: "/forgot-password",
  noIndex: true,
});

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
