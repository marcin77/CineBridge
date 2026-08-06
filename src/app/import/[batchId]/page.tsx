import BatchDetail from "@/components/BatchDetail";

export const dynamic = "force-dynamic";

export default async function ImportBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <BatchDetail batchId={Number(batchId)} />
    </div>
  );
}
