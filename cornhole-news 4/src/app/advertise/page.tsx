export default function AdvertisePage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Advertise on Cornhole News</h1>
      <p className="mb-6 text-[15px] leading-relaxed">
        Reach an engaged audience of cornhole players, fans, league organizers,
        and gear enthusiasts.
      </p>

      <div className="space-y-4 rounded border border-[#e0e0e0] bg-white p-5">
        <h2 className="text-lg font-semibold">Ad Placements</h2>
        <ul className="list-disc space-y-2 pl-5 text-[15px]">
          <li>
            <strong>Sidebar 300×250</strong> — Standard medium rectangle
          </li>
          <li>
            <strong>Sidebar 300×600</strong> — Tall skyscraper unit
          </li>
        </ul>

        <p className="pt-2 text-[15px]">
          Interested in advertising? Reach out and we&apos;ll get back to you
          with rates and availability.
        </p>

        <p className="text-sm text-[#666]">
          (Contact form / email will be added here once the site is live.)
        </p>
      </div>
    </div>
  );
}
