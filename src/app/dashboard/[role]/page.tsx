import Dashboard from "./Dashboard";
export default async function Page({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  return <Dashboard params={{ role }} />;
}
