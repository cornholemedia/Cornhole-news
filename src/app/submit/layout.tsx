import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Submit",
  description: "Submit a cornhole link or start a discussion on Cornhole News.",
  path: "/submit",
});

export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return children;
}
