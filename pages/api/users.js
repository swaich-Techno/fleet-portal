import {
  canManageUsers,
  cleanText,
  countUsers,
  ensureSeedData,
  getAuthUser,
  hashPassword,
  normalizeUsername,
  parseRequestBody,
  sanitizeUser,
  signUserToken
} from "../../lib/auth";
import { connectDB } from "../../lib/mongodb";
import User from "../../models/User";

function safeRole(role = "") {
  return role === "editor" || role === "admin" ? role : "viewer";
}

function safeRequestedRole(role = "") {
  return role === "editor" ? "editor" : "viewer";
}

export default async function handler(req, res) {
  try {
    await connectDB();
    await ensureSeedData();

    if (req.method === "GET") {
      const authUser = await getAuthUser(req);

      if (!canManageUsers(authUser)) {
        return res.status(401).json({ error: "Admin access is required." });
      }

      const users = await User.find().sort({ createdAt: -1 }).lean();

      return res.status(200).json({
        users: users.map(sanitizeUser)
      });
    }

    if (req.method === "POST") {
      const body = parseRequestBody(req);
      const fullName = cleanText(body.fullName);
      const username = normalizeUsername(body.username);
      const password = cleanText(body.password);
      const requestedRole = safeRequestedRole(body.requestedRole);
      const existingUsers = await countUsers();

      if (!fullName || !username || !password) {
        return res.status(400).json({
          error: "Full name, username, and password are required."
        });
      }

      const existingAccount = await User.findOne({ username });

      if (existingAccount) {
        return res.status(409).json({
          error: "That username is already being used."
        });
      }

      const passwordHash = await hashPassword(password);

      if (existingUsers === 0) {
        const adminUser = await User.create({
          fullName,
          username,
          passwordHash,
          role: "admin",
          requestedRole: "admin",
          status: "approved",
          approvedAt: new Date(),
          lastLoginAt: new Date()
        });

        return res.status(201).json({
          token: signUserToken(adminUser),
          user: sanitizeUser(adminUser)
        });
      }

      const pendingUser = await User.create({
        fullName,
        username,
        passwordHash,
        role: requestedRole,
        requestedRole,
        status: "pending"
      });

      return res.status(201).json({
        message:
          "Access request submitted. An admin can now approve you for viewer or editor access.",
        user: sanitizeUser(pendingUser)
      });
    }

    if (req.method === "PATCH") {
      const authUser = await getAuthUser(req);

      if (!canManageUsers(authUser)) {
        return res.status(401).json({ error: "Admin access is required." });
      }

      const { userId, role, status } = parseRequestBody(req);

      if (!userId) {
        return res.status(400).json({ error: "A user id is required." });
      }

      if (String(authUser._id) === String(userId) && status && status !== "approved") {
        return res.status(400).json({
          error: "You cannot suspend your own admin account from this screen."
        });
      }

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      if (role) {
        user.role = safeRole(role);
      }

      if (status) {
        user.status = status === "approved" ? "approved" : status === "suspended" ? "suspended" : "pending";
      }

      if (user.status === "approved" && !user.approvedAt) {
        user.approvedAt = new Date();
      }

      await user.save();

      const users = await User.find().sort({ createdAt: -1 }).lean();

      return res.status(200).json({
        users: users.map(sanitizeUser)
      });
    }

    res.setHeader("Allow", ["GET", "POST", "PATCH"]);
    return res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to process the user request right now."
    });
  }
}
