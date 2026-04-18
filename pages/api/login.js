import {
  cleanText,
  ensureSeedData,
  normalizeUsername,
  parseRequestBody,
  sanitizeUser,
  signUserToken,
  verifyPassword
} from "../../lib/auth";
import { connectDB } from "../../lib/mongodb";
import User from "../../models/User";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    await connectDB();
    await ensureSeedData();

    const { username, password } = parseRequestBody(req);
    const normalizedUsername = normalizeUsername(username);
    const normalizedPassword = cleanText(password);

    if (!normalizedUsername || !normalizedPassword) {
      return res.status(400).json({ error: "Enter both username and password." });
    }

    const user = await User.findOne({ username: normalizedUsername });

    if (!user) {
      return res.status(401).json({ error: "No account was found for that username." });
    }

    if (user.status === "pending") {
      return res.status(403).json({
        error: "Your access request is still pending admin approval."
      });
    }

    if (user.status === "suspended") {
      return res.status(403).json({
        error: "This account is currently suspended. Please contact the admin."
      });
    }

    const passwordMatches = await verifyPassword(normalizedPassword, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Incorrect password." });
    }

    user.lastLoginAt = new Date();
    await user.save();

    return res.status(200).json({
      token: signUserToken(user),
      user: sanitizeUser(user)
    });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to sign in right now. Check your MongoDB connection and try again."
    });
  }
}
