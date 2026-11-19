import Link from "next/link";
import { createEditablePage } from "@/lib/editable-route";

function AboutFaqLink() {
  return (
    <p className="mt-6 text-[15px] leading-relaxed">
      Common questions are answered on the <Link href="/faq" className="hover:underline">FAQ</Link>.
    </p>
  );
}

const page = createEditablePage("about", AboutFaqLink);

export const revalidate = 3600;
export const generateMetadata = page.generateMetadata;
export default page.Page;
