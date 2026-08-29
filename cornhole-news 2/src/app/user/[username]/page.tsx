export default async function UserPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{username}</h1>
      <div className="rounded border border-[#e0e0e0] bg-white p-4 text-sm text-[#666]">
        User profiles aren&apos;t hooked up yet — this is still a frontend
        framework running on mock data. Once Supabase auth is connected,
        real profile info will show up here.
      </div>
    </div>
  );
}
