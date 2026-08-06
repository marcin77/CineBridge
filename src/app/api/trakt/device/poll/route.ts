import { pollDeviceToken, saveTraktTokens } from "@/lib/trakt";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();
  const deviceCode = body?.deviceCode as string | undefined;
  if (!deviceCode) return Response.json({ error: "Brak device_code." }, { status: 400 });

  const result = await pollDeviceToken(deviceCode);

  if (result.status === "success") {
    await saveTraktTokens(result.data);
    return Response.json({ status: "success" });
  }

  return Response.json({ status: result.status });
}
