import { Router } from 'express';
import type { Request, Response } from 'express';
import { users } from '../lib/db.js';
import { hashPassword, comparePassword } from '../lib/hash.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../lib/jwt.js';
import { authenticate } from '../middleware/authenticate.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/auth.js';

const router = Router();

router.use(authRateLimit);

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const { email, username, password } = parsed.data;

    const existing = await users().findOne({ $or: [{ email }, { username }] });
    if (existing) {
      res.status(409).json({ success: false, error: 'An account with this email or username already exists' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();

    await users().insertOne({
      email,
      username,
      passwordHash,
      isVerified: true,
      refreshToken: null,
      refreshTokenExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    });

    res.status(201).json({ success: true, data: { message: 'Registration successful. You can login now.' } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const { email, password } = parsed.data;

    const user = await users().findOne({ email });
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const userId = user._id!.toString();
    const accessToken = generateAccessToken(userId);
    const refreshToken = generateRefreshToken(userId);
    const refreshTokenHash = await hashPassword(refreshToken);

    await users().updateOne(
      { _id: user._id },
      {
        $set: {
          refreshToken: refreshTokenHash,
          refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        },
      }
    );

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: { id: userId, email: user.email, username: user.username },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Refresh token
router.post('/refresh-token', async (req: Request, res: Response) => {
  try {
    const parsed = refreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const { refreshToken } = parsed.data;

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
      return;
    }

    const { ObjectId } = await import('mongodb');
    const user = await users().findOne({ _id: new ObjectId(payload.userId) as any });
    if (!user || !user.refreshToken) {
      res.status(401).json({ success: false, error: 'Invalid refresh token' });
      return;
    }

    const valid = await comparePassword(refreshToken, user.refreshToken);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid refresh token' });
      return;
    }

    const userId = user._id!.toString();
    const newAccessToken = generateAccessToken(userId);
    const newRefreshToken = generateRefreshToken(userId);
    const newRefreshTokenHash = await hashPassword(newRefreshToken);

    await users().updateOne(
      { _id: user._id },
      {
        $set: {
          refreshToken: newRefreshTokenHash,
          refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        },
      }
    );

    res.json({
      success: true,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Logout
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const { ObjectId } = await import('mongodb');
    await users().updateOne(
      { _id: new ObjectId(req.user!.userId) as any },
      { $set: { refreshToken: null, refreshTokenExpiresAt: null, updatedAt: new Date() } }
    );
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const { ObjectId } = await import('mongodb');
    const user = await users().findOne(
      { _id: new ObjectId(req.user!.userId) as any },
      { projection: { _id: 1, email: 1, username: 1 } }
    );

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: { id: user._id!.toString(), email: user.email, username: user.username } });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
