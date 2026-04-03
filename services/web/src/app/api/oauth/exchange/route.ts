import { verifierStore } from "../start/route";

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const TOKEN_URL = "https://console.anthropic.com/v1/oauth/token";
const REDIRECT_URI = "https://platform.claude.com/oauth/code/callback";

export async function POST(req: Request) {
  try {
    const { code, state } = await req.json();

    if (!code || !state) {
      return Response.json(
        { success: false, error: "code and state are required" },
        { status: 400 }
      );
    }

    const stored = verifierStore.get(state);
    if (!stored) {
      return Response.json(
        {
          success: false,
          error: "Invalid or expired state. Start the flow again.",
        },
        { status: 400 }
      );
    }

    const { verifier } = stored;

    let cleanCode = code.trim();
    if (cleanCode.includes("#")) cleanCode = cleanCode.split("#")[0];
    if (cleanCode.includes("?")) cleanCode = cleanCode.split("?")[0];
    cleanCode = cleanCode.trim();

    console.log("Exchange attempt:", {
      codeLength: cleanCode.length,
      codePrefix: cleanCode.slice(0, 10),
      stateLength: state.length,
    });

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: cleanCode,
      code_verifier: verifier,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      state: verifier,
    });

    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "claude-code/2.1.79",
      },
      body: body.toString(),
    });

    const responseText = await tokenRes.text();
    console.log(
      "Token response:",
      tokenRes.status,
      responseText.slice(0, 200)
    );

    if (!tokenRes.ok) {
      return Response.json(
        {
          success: false,
          error: `Exchange failed (${tokenRes.status}): ${responseText.slice(0, 200)}`,
        },
        { status: 400 }
      );
    }

    verifierStore.delete(state);

    const data = JSON.parse(responseText) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return Response.json({
      success: true,
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Token exchange failed";
    console.error("OAuth exchange error:", error);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
