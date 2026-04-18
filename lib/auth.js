import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { DEFAULT_TECHNICIANS } from "./constants";
import { connectDB } from "./mongodb";
import Technician from "../models/Technician";
import User from "../models/User";

const DEV_JWT_SECRET = "fleet-portal-dev-secret";

export function normalizeUsername(value = "") {
  return String(value).trim().toLowerCase();
}

export function cleanText(value = "") {
  return String(value).trim();
}

export function parseRequestBody(req) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch (error) {
      return {};
    }
  }

  return req.body || {};
}

export function getJwtSecret() {
  return process.env.JWT_SECRET || DEV_JWT_SECRET;
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: String(user._id || user.id || ""),
    fullName: user.fullName || "",
    username: user.username || "",
    role: user.role || "viewer",
    status: user.status || "pending",
    requestedRole: user.requestedRole || user.role || "viewer",
    approvedAt: user.approvedAt || null,
    createdAt: user.createdAt || null,
    lastLoginAt: user.lastLoginAt || null
  };
}

export function signUserToken(user) {
  return jwt.sign({ id: String(user._id) }, getJwtSecret(), {
    expiresIn: "12h"
  });
}

export async function ensureSeedData() {
  await connectDB();

  const technicianCount = await Technician.countDocuments();

  if (technicianCount > 0) {
    return;
  }

  await Technician.insertMany(
    DEFAULT_TECHNICIANS.map((tech, index) => ({
      ...tech,
      active: true,
      sortOrder: index
    }))
  );
}

export async function getAuthUser(req) {
  await connectDB();
  await ensureSeedData();

  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  try {
    const payload = jwt.verify(header.slice(7), getJwtSecret());
    const user = await User.findById(payload.id);

    if (!user) {
      return null;
    }

    return user;
  } catch (error) {
    return null;
  }
}

export function requireApprovedUser(user, res) {
  if (!user || user.status !== "approved") {
    res.status(401).json({ error: "Please sign in with an approved account." });
    return false;
  }

  return true;
}

export function canEditEntries(user) {
  return Boolean(
    user &&
      user.status === "approved" &&
      (user.role === "admin" || user.role === "editor")
  );
}

export function canManageUsers(user) {
  return Boolean(user && user.status === "approved" && user.role === "admin");
}

export async function countUsers() {
  await connectDB();
  return User.countDocuments();
}
