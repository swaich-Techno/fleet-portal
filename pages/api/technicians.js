import {
  canManageUsers,
  cleanText,
  ensureSeedData,
  getAuthUser,
  requireApprovedUser,
  parseRequestBody
} from "../../lib/auth";
import { connectDB } from "../../lib/mongodb";
import Technician from "../../models/Technician";

function normalizeTechnician(doc) {
  return {
    _id: String(doc._id || ""),
    name: doc.name || "",
    payType: doc.payType || "salary",
    active: doc.active !== false,
    sortOrder: doc.sortOrder ?? 0
  };
}

export default async function handler(req, res) {
  try {
    await connectDB();
    await ensureSeedData();

    const authUser = await getAuthUser(req);

    if (req.method === "GET") {
      if (!requireApprovedUser(authUser, res)) {
        return;
      }

      const technicians = await Technician.find().sort({ sortOrder: 1, name: 1 }).lean();

      return res.status(200).json({
        technicians: technicians.map(normalizeTechnician)
      });
    }

    if (!canManageUsers(authUser)) {
      return res.status(401).json({ error: "Admin access is required." });
    }

    if (req.method === "POST") {
      const { name, payType } = parseRequestBody(req);
      const trimmedName = cleanText(name);

      if (!trimmedName) {
        return res.status(400).json({ error: "Technician name is required." });
      }

      const duplicate = await Technician.findOne({
        name: new RegExp(`^${escapeRegex(trimmedName)}$`, "i")
      });

      if (duplicate) {
        return res.status(409).json({ error: "That technician already exists." });
      }

      const lastTechnician = await Technician.findOne().sort({ sortOrder: -1 }).lean();

      await Technician.create({
        name: trimmedName,
        payType: payType === "hourly" ? "hourly" : "salary",
        active: true,
        sortOrder: (lastTechnician?.sortOrder ?? 0) + 1
      });
    }

    if (req.method === "PATCH") {
      const { technicianId, payType, active } = parseRequestBody(req);

      if (!technicianId) {
        return res.status(400).json({ error: "A technician id is required." });
      }

      const technician = await Technician.findById(technicianId);

      if (!technician) {
        return res.status(404).json({ error: "Technician not found." });
      }

      if (payType) {
        technician.payType = payType === "hourly" ? "hourly" : "salary";
      }

      if (typeof active === "boolean") {
        technician.active = active;
      }

      await technician.save();
    }

    if (req.method === "DELETE") {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: "A technician id is required." });
      }

      await Technician.findByIdAndDelete(id);
    }

    const technicians = await Technician.find().sort({ sortOrder: 1, name: 1 }).lean();

    return res.status(200).json({
      technicians: technicians.map(normalizeTechnician)
    });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to process the technician request."
    });
  }
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
