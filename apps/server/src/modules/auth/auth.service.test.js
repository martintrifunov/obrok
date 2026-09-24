import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "./auth.service.js";
import { UnauthorizedError } from "../../shared/errors/UnauthorizedError.js";
import bcrypt from "bcrypt";

vi.mock("bcrypt");

const mockAuthRepository = {
  findByUsername: vi.fn(),
  findByRefreshToken: vi.fn(),
  save: vi.fn(),
  rotateRefreshToken: vi.fn(),
  removeRefreshToken: vi.fn(),
  clearRefreshTokens: vi.fn(),
};

const mockTokenService = {
  generateAccessToken: vi.fn(() => "access-token"),
  generateRefreshToken: vi.fn(() => "refresh-token"),
  verifyRefreshToken: vi.fn(),
};

const makeSut = () => new AuthService(mockAuthRepository, mockTokenService);

beforeEach(() => vi.clearAllMocks());

describe("AuthService", () => {
  describe("login", () => {
    it("throws UnauthorizedError if user not found", async () => {
      mockAuthRepository.findByUsername.mockResolvedValue(null);
      const sut = makeSut();
      await expect(sut.login("maco", "123", null)).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it("throws UnauthorizedError if password does not match", async () => {
      mockAuthRepository.findByUsername.mockResolvedValue({
        username: "maco",
        password: "hashed",
        refreshToken: [],
      });
      bcrypt.compare.mockResolvedValue(false);
      const sut = makeSut();
      await expect(sut.login("maco", "wrong", null)).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it("returns tokens on successful login", async () => {
      const user = {
        username: "maco",
        password: "hashed",
        refreshToken: [],
      };
      mockAuthRepository.findByUsername.mockResolvedValue(user);
      bcrypt.compare.mockResolvedValue(true);
      mockAuthRepository.save.mockResolvedValue(null);
      const sut = makeSut();
      const result = await sut.login("maco", "123", null);
      expect(result).toEqual({
        accessToken: "access-token",
        newRefreshToken: "refresh-token",
      });
      expect(mockAuthRepository.save).toHaveBeenCalled();
    });

    it("filters out existing refresh token on reuse", async () => {
      const user = {
        username: "maco",
        password: "hashed",
        refreshToken: ["old-token"],
      };
      mockAuthRepository.findByUsername.mockResolvedValue(user);
      mockAuthRepository.findByRefreshToken.mockResolvedValue(user);
      bcrypt.compare.mockResolvedValue(true);
      mockAuthRepository.save.mockResolvedValue(null);
      const sut = makeSut();
      await sut.login("maco", "123", "old-token");
      expect(user.refreshToken).not.toContain("old-token");
    });
  });

  describe("logout", () => {
    it("does nothing if no refresh token provided", async () => {
      const sut = makeSut();
      await sut.logout(undefined);
      expect(mockAuthRepository.findByRefreshToken).not.toHaveBeenCalled();
    });

    it("does nothing if user not found for refresh token", async () => {
      mockAuthRepository.findByRefreshToken.mockResolvedValue(null);
      const sut = makeSut();
      await sut.logout("some-token");
      expect(mockAuthRepository.save).not.toHaveBeenCalled();
    });

    it("removes refresh token from user and saves", async () => {
      const user = { refreshToken: ["token-abc"] };
      mockAuthRepository.findByRefreshToken.mockResolvedValue(user);
      mockAuthRepository.save.mockResolvedValue(null);
      const sut = makeSut();
      await sut.logout("token-abc");
      expect(user.refreshToken).not.toContain("token-abc");
      expect(mockAuthRepository.save).toHaveBeenCalledWith(user);
    });
  });

  describe("refresh", () => {
    it("throws UnauthorizedError if no token provided", async () => {
      const sut = makeSut();
      await expect(sut.refresh(undefined)).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError if token not in db and clears hacked user tokens", async () => {
      mockAuthRepository.findByRefreshToken.mockResolvedValue(null);
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        username: "maco",
      });
      const hackedUser = { _id: "u1", refreshToken: ["token-abc"] };
      mockAuthRepository.findByUsername.mockResolvedValue(hackedUser);
      mockAuthRepository.clearRefreshTokens.mockResolvedValue(null);
      const sut = makeSut();
      await expect(sut.refresh("token-abc")).rejects.toThrow(UnauthorizedError);
      expect(mockAuthRepository.clearRefreshTokens).toHaveBeenCalledWith("u1");
    });

    it("returns new tokens on valid refresh", async () => {
      const user = { _id: "u1", username: "maco", refreshToken: ["token-abc"] };
      mockAuthRepository.findByRefreshToken.mockResolvedValue(user);
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        username: "maco",
      });
      mockAuthRepository.rotateRefreshToken.mockResolvedValue(user);
      const sut = makeSut();
      const result = await sut.refresh("token-abc");
      expect(result).toEqual({
        accessToken: "access-token",
        newRefreshToken: "refresh-token",
      });
      expect(mockAuthRepository.rotateRefreshToken).toHaveBeenCalledWith(
        "u1",
        "token-abc",
        "refresh-token",
      );
    });

    describe("concurrent refresh of the same token", () => {
      const user = { _id: "u1", username: "maco", role: "admin", refreshToken: ["token-abc"] };

      const rotateOnce = async (sut) => {
        mockAuthRepository.findByRefreshToken.mockResolvedValueOnce(user);
        mockTokenService.verifyRefreshToken.mockResolvedValue({ username: "maco" });
        mockAuthRepository.rotateRefreshToken.mockResolvedValueOnce(user);
        return sut.refresh("token-abc");
      };

      it("gives the late request the already-rotated token instead of wiping sessions", async () => {
        const sut = makeSut();
        await rotateOnce(sut);

        // The old token is gone from the DB; its successor is present.
        mockAuthRepository.findByRefreshToken.mockImplementation(async (token) =>
          token === "refresh-token" ? user : null,
        );
        const result = await sut.refresh("token-abc");

        expect(result).toEqual({
          accessToken: "access-token",
          newRefreshToken: "refresh-token",
        });
        expect(mockAuthRepository.clearRefreshTokens).not.toHaveBeenCalled();
      });

      it("recovers when both requests found the user but lost the atomic swap", async () => {
        const sut = makeSut();
        await rotateOnce(sut);

        mockAuthRepository.findByRefreshToken.mockImplementation(async (token) =>
          token === "token-abc" || token === "refresh-token" ? user : null,
        );
        mockAuthRepository.rotateRefreshToken.mockResolvedValueOnce(null);
        const result = await sut.refresh("token-abc");

        expect(result.newRefreshToken).toBe("refresh-token");
        expect(mockAuthRepository.clearRefreshTokens).not.toHaveBeenCalled();
      });

      it("still treats reuse after the grace window as theft", async () => {
        let now = 1_000_000;
        const sut = new AuthService(mockAuthRepository, mockTokenService, {
          now: () => now,
        });
        await rotateOnce(sut);

        now += 16_000;
        mockAuthRepository.findByRefreshToken.mockResolvedValue(null);
        mockAuthRepository.findByUsername.mockResolvedValue(user);
        await expect(sut.refresh("token-abc")).rejects.toThrow(UnauthorizedError);
        expect(mockAuthRepository.clearRefreshTokens).toHaveBeenCalledWith("u1");
      });

      it("does not redeem a successor that was itself revoked", async () => {
        const sut = makeSut();
        await rotateOnce(sut);

        mockAuthRepository.findByRefreshToken.mockResolvedValue(null);
        mockAuthRepository.findByUsername.mockResolvedValue(user);
        await expect(sut.refresh("token-abc")).rejects.toThrow(UnauthorizedError);
      });
    });
  });
});
