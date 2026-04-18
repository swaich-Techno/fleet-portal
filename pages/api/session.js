import {
  countUsers,
  ensureSeedData,
  getAuthUser,
  sanitizeUser
} from "../../lib/auth";
import { connectDB } from "../../lib/mongodb";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    await connectDB();
    await ensureSeedData();

    const user = await getAuthUser(req);
    const userCount = await countUsers();

    return res.status(200).json({
      setupRequired: userCount === 0,
      user: sanitizeUser(user)
    });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to load the session."
    });
  }
}
