import bcrypt from "bcrypt";
import { UnauthorizedError } from "../../shared/errors/UnauthorizedError.js";

// Concurrent refreshes (two tabs, or PersistLogin racing a 401 retry) send the
// same cookie. The loser must not be treated as token reuse, so a rotated token
// stays redeemable for its successor briefly. In-memory is fine: the API runs
// as a single process.
const ROTATION_GRACE_MS = 15_000;

export class AuthService {
  constructor(authRepository, tokenService, { now = () => Date.now() } = {}) {
    this.authRepository = authRepository;
    this.tokenService = tokenService;
    this.now = now;
    this.recentRotations = new Map();
  }

  #rememberRotation(oldToken, newToken) {
    const now = this.now();
    for (const [token, entry] of this.recentRotations) {
      if (entry.expiresAt <= now) this.recentRotations.delete(token);
    }
    this.recentRotations.set(oldToken, {
      newToken,
      expiresAt: now + ROTATION_GRACE_MS,
    });
  }

  async #redeemRecentRotation(oldToken) {
    const entry = this.recentRotations.get(oldToken);
    if (!entry || entry.expiresAt <= this.now()) return null;

    const user = await this.authRepository.findByRefreshToken(entry.newToken);
    if (!user) return null;

    return {
      accessToken: this.tokenService.generateAccessToken(user.username, user.role),
      newRefreshToken: entry.newToken,
    };
  }

  async login(username, password, existingRefreshToken) {
    const user = await this.authRepository.findByUsername(username);
    if (!user) throw new UnauthorizedError();

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new UnauthorizedError();

    // Build new refresh token array — drop the old cookie token if present
    let refreshTokenArray = !existingRefreshToken
      ? user.refreshToken
      : user.refreshToken.filter((rt) => rt !== existingRefreshToken);

    // If cookie token exists but isn't in DB it was already used —
    // possible reuse attack, wipe all tokens for this user
    if (existingRefreshToken) {
      const tokenInDb =
        await this.authRepository.findByRefreshToken(existingRefreshToken);
      if (!tokenInDb) refreshTokenArray = [];
    }

    const accessToken = this.tokenService.generateAccessToken(user.username, user.role);
    const newRefreshToken = this.tokenService.generateRefreshToken(
      user.username,
    );

    user.refreshToken = [...refreshTokenArray, newRefreshToken];
    await this.authRepository.save(user);

    return { accessToken, newRefreshToken };
  }

  async logout(refreshToken) {
    if (!refreshToken) return;

    const user = await this.authRepository.findByRefreshToken(refreshToken);

    // Token not in DB — still clear the cookie on the controller side
    if (!user) return;

    user.refreshToken = user.refreshToken.filter((rt) => rt !== refreshToken);
    await this.authRepository.save(user);
  }

  async refresh(existingRefreshToken) {
    if (!existingRefreshToken) throw new UnauthorizedError();

    const user =
      await this.authRepository.findByRefreshToken(existingRefreshToken);

    if (!user) {
      const graced = await this.#redeemRecentRotation(existingRefreshToken);
      if (graced) return graced;

      // Refresh token reuse detected
      try {
        const decoded =
          await this.tokenService.verifyRefreshToken(existingRefreshToken);

        // Token was valid but not in DB — wipe the hacked user's tokens
        const hackedUser = await this.authRepository.findByUsername(
          decoded.username,
        );

        if (hackedUser) {
          await this.authRepository.clearRefreshTokens(hackedUser._id);
        }
      } catch {
        // Invalid token — no further action needed
      }

      throw new UnauthorizedError();
    }

    try {
      const decoded =
        await this.tokenService.verifyRefreshToken(existingRefreshToken);

      // Token valid but username mismatch — tampered token
      if (user.username !== decoded.username) {
        throw new UnauthorizedError();
      }

      const accessToken = this.tokenService.generateAccessToken(
        decoded.username,
        user.role,
      );
      const newRefreshToken = this.tokenService.generateRefreshToken(
        user.username,
      );

      // Atomic swap: pull old token + push new token in one operation.
      // If a concurrent request already consumed this token, updated is null.
      const updated = await this.authRepository.rotateRefreshToken(
        user._id,
        existingRefreshToken,
        newRefreshToken,
      );
      if (!updated) {
        // Lost the race to a concurrent refresh of the same token.
        const graced = await this.#redeemRecentRotation(existingRefreshToken);
        if (graced) return graced;
        throw new UnauthorizedError();
      }

      this.#rememberRotation(existingRefreshToken, newRefreshToken);
      return { accessToken, newRefreshToken };
    } catch (err) {
      // Token expired or tampered — remove old token atomically and reject
      await this.authRepository.removeRefreshToken(
        user._id,
        existingRefreshToken,
      );
      throw err instanceof UnauthorizedError ? err : new UnauthorizedError();
    }
  }
}
