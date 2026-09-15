import { GoogleAuth } from "google-auth-library";

const scope = "https://www.googleapis.com/auth/devstorage.read_write";

function configuration() {
  const bucket = process.env.GCS_BUCKET;
  const projectId = process.env.GCS_PROJECT_ID;
  const clientEmail = process.env.GCS_CLIENT_EMAIL;
  const privateKey = process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!bucket || !projectId || !clientEmail || !privateKey) throw new Error("GCS uploads are not configured.");
  return { bucket, projectId, clientEmail, privateKey };
}

async function client() {
  const { projectId, clientEmail, privateKey } = configuration();
  return new GoogleAuth({ credentials: { project_id: projectId, client_email: clientEmail, private_key: privateKey }, scopes: [scope] }).getClient();
}

export async function uploadCompanyAsset(key: string, data: Buffer, contentType: string) {
  const { bucket } = configuration();
  const auth = await client();
  await auth.request({ method: "POST", url: `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(key)}`, data, headers: { "Content-Type": contentType } });
}

export async function readCompanyAsset(key: string) {
  const { bucket } = configuration();
  const auth = await client();
  const response = await auth.request<ArrayBuffer>({ method: "GET", url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(key)}?alt=media`, responseType: "arraybuffer" });
  return Buffer.from(response.data);
}
