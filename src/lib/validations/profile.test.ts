import { describe, expect, it } from "vitest";
import { getChangePasswordSchema, getProfileSchema } from "@/lib/validations/profile";

describe("profile validation", () => {
  it("normalizes the user's email", () => {
    const result = getProfileSchema("en").parse({
      name: "Francisco Leanos",
      title: "Field Service Engineer",
      email: "Francisco.Leanos@SIG.BIZ",
    });

    expect(result.email).toBe("francisco.leanos@sig.biz");
  });

  it("accepts a strong matching password", () => {
    const result = getChangePasswordSchema("en").safeParse({
      currentPassword: "CurrentPassword1!",
      newPassword: "Replacement2027!",
      confirmPassword: "Replacement2027!",
    });

    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = getChangePasswordSchema("en").safeParse({
      currentPassword: "CurrentPassword1!",
      newPassword: "Replacement2027!",
      confirmPassword: "Different2027!",
    });

    expect(result.success).toBe(false);
  });
});
