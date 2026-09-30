import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Sign up",
  description: "Create a Cornhole News account.",
  path: "/signup",
});

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
