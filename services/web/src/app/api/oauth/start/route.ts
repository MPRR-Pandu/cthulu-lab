import { randomBytes, createHash } from "crypto";

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
const REDIRECT_URI = "https://platform.claude.com/oauth/code/callback";
const SCOPES =
  "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload";

const verifierStore = new Map<
  string,
  { verifier: string; createdAt: number }
>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of verifierStore) {
    if (now - val.createdAt > 600000) verifierStore.delete(key);
  }
}, 600000);

function base64url(buf: Buffer): string {
  return buf.toString("base64url").replace(/=+$/, "");
}

export async function POST() {
  try {
    const verifier = base64url(randomBytes(32));
    const challenge = base64url(
      createHash("sha256").update(verifier).digest()
    );

    verifierStore.set(verifier, { verifier, createdAt: Date.now() });

    const searchParams = new URLSearchParams({
      code: "true",
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: verifier,
    });

    const url = `${AUTHORIZE_URL}?${searchParams}`;

    return Response.json({ success: true, data: { url, state: verifier } });
  } catch (error) {
    console.error("OAuth start error:", error);
    return Response.json(
      { success: false, error: "Failed to generate OAuth URL" },
      { status: 500 }
    );
  }
}

export { verifierStore };
