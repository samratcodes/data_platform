import { nodes } from "@/components/Landing/nodes";
import { getUser } from "@/lib/auth";
import { samplePoints } from "@/lib/sample-data";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!await getUser()) return Response.json({ error: "Log in to download samples." }, { status: 401 });
  const { slug } = await context.params;
  const operator = nodes.find((node) => node.slug === slug);
  if (!operator) return Response.json({ error: "Operator not found" }, { status: 404 });
  const pointcloud = new URL(request.url).searchParams.get("format") === "ply";
  const points = samplePoints().map(({ x, y, z }) => `${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)} 42 205 170`);
  const content = pointcloud ? `ply\nformat ascii 1.0\ncomment FileMarket generated demonstration sample; not captured sensor data\nelement vertex 360\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n${points.join("\n")}\n` : JSON.stringify({
    kind: "FileMarket demonstration metadata", synthetic: true, operator: operator.name,
    city: operator.city, country: operator.country, cityCenter: operator.coordinates,
    modalities: operator.modalities, environments: operator.profile.captureEnvironments,
    samples: Array.from({ length: 12 }, (_, index) => ({ frame: index, timestampMs: index * 100, split: "sample", annotation: "demonstration" })),
  }, null, 2);
  return new Response(content, { headers: { "Content-Type": pointcloud ? "application/octet-stream" : "application/json", "Content-Disposition": `attachment; filename="${slug}-demo.${pointcloud ? "ply" : "json"}"`, "Cache-Control": "private, no-store" } });
}
