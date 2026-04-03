import { Router } from 'express';
import type { Request, Response } from 'express';
import { randomBytes, createHash } from 'crypto';

const router = Router();

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const AUTHORIZE_URL = 'https://claude.ai/oauth/authorize';
const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const REDIRECT_URI = 'https://platform.claude.com/oauth/code/callback';
const SCOPES = 'org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload';

const verifierStore = new Map<string, { verifier: string; createdAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of verifierStore) {
    if (now - val.createdAt > 600000) verifierStore.delete(key);
  }
}, 600000);

function base64url(buf: Buffer): string {
  return buf.toString('base64url').replace(/=+$/, '');
}

router.post('/start', (_req: Request, res: Response) => {
  try {
    // Match Claude CLI exactly: verifier is used as state too
    const verifier = base64url(randomBytes(32));
    const challenge = base64url(createHash('sha256').update(verifier).digest());

    verifierStore.set(verifier, { verifier, createdAt: Date.now() });

    const params = new URLSearchParams({
      code: 'true',
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: verifier,
    });

    const url = `${AUTHORIZE_URL}?${params}`;

    res.json({ success: true, data: { url, state: verifier } });
  } catch (error) {
    console.error('OAuth start error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate OAuth URL' });
  }
});

router.post('/exchange', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.body;

    if (!code || !state) {
      res.status(400).json({ success: false, error: 'code and state are required' });
      return;
    }

    const stored = verifierStore.get(state);
    if (!stored) {
      res.status(400).json({ success: false, error: 'Invalid or expired state. Start the flow again.' });
      return;
    }

    const { verifier } = stored;

    // Clean the code — remove hash fragments, whitespace, URL encoding artifacts
    let cleanCode = code.trim();
    if (cleanCode.includes('#')) cleanCode = cleanCode.split('#')[0];
    if (cleanCode.includes('?')) cleanCode = cleanCode.split('?')[0];
    cleanCode = cleanCode.trim();

    console.log('Exchange attempt:', { codeLength: cleanCode.length, codePrefix: cleanCode.slice(0, 10), stateLength: state.length });

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: cleanCode,
      code_verifier: verifier,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      state: verifier,
    });

    // Single call — no retry to avoid rate limiting
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'claude-code/2.1.79',
      },
      body: body.toString(),
    });

    const responseText = await tokenRes.text();
    console.log('Token response:', tokenRes.status, responseText.slice(0, 200));

    if (!tokenRes.ok) {
      // Don't delete verifier on failure so user can retry
      res.status(400).json({ success: false, error: `Exchange failed (${tokenRes.status}): ${responseText.slice(0, 200)}` });
      return;
    }

    // Success — delete verifier
    verifierStore.delete(state);

    const data = JSON.parse(responseText) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    res.json({
      success: true,
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Token exchange failed';
    console.error('OAuth exchange error:', error);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
