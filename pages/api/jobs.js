import {
  canEditEntries,
  ensureSeedData,
  getAuthUser,
  parseRequestBody,
  requireApprovedUser,
  cleanText
} from "../../lib/auth";
import { connectDB } from "../../lib/mongodb";
import { normalizeJob, parseTimeToMinutes } from "../../lib/payroll";
import Job from "../../models/Job";
import Technician from "../../models/Technician";

function isValidTime(value = "") {
  return /^\d{2}:\d{2}$/.test(value);
}

function toMinutesNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

async function loadJobs() {
  const jobs = await Job.find().sort({ date: -1, createdAt: -1 }).lean();
  return jobs.map(normalizeJob);
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

      return res.status(200).json({
        jobs: await loadJobs()
      });
    }

    if (!requireApprovedUser(authUser, res)) {
      return;
    }

    if (!canEditEntries(authUser)) {
      return res.status(403).json({
        error: "Your account has view-only access."
      });
    }

    if (req.method === "POST") {
      const body = parseRequestBody(req);

      if (
        !body.technicianId ||
        !body.date ||
        !cleanText(body.customer) ||
        !cleanText(body.issue) ||
        !cleanText(body.location) ||
        !isValidTime(body.dispatchTime) ||
        !isValidTime(body.arrivalTime) ||
        !isValidTime(body.finishedTime)
      ) {
        return res.status(400).json({
          error: "Please complete every required entry field."
        });
      }

      const arrivalMinutes = parseTimeToMinutes(body.arrivalTime);
      const finishedMinutes = parseTimeToMinutes(body.finishedTime);

      if (finishedMinutes === null || arrivalMinutes === null || finishedMinutes <= arrivalMinutes) {
        return res.status(400).json({
          error: "Finished time must be later than arrival time."
        });
      }

      const technician = await Technician.findById(body.technicianId);

      if (!technician || technician.active === false) {
        return res.status(404).json({
          error: "Select an active technician before saving the entry."
        });
      }

      await Job.create({
        technicianId: technician._id,
        technicianName: technician.name,
        payType: technician.payType,
        date: body.date,
        customer: cleanText(body.customer),
        issue: cleanText(body.issue),
        location: cleanText(body.location),
        dispatchTime: body.dispatchTime,
        etaToHours: toMinutesNumber(body.etaToHours),
        etaToMinutes: toMinutesNumber(body.etaToMinutes),
        arrivalTime: body.arrivalTime,
        finishedTime: body.finishedTime,
        etaFromHours: toMinutesNumber(body.etaFromHours),
        etaFromMinutes: toMinutesNumber(body.etaFromMinutes),
        etaFromDestination:
          body.etaFromDestination === "next_job" ? "next_job" : "home",
        createdById: authUser._id,
        createdByName: authUser.fullName,
        createdByUsername: authUser.username
      });

      return res.status(201).json({
        jobs: await loadJobs()
      });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: "A job id is required." });
      }

      await Job.findByIdAndDelete(id);

      return res.status(200).json({
        jobs: await loadJobs()
      });
    }

    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    return res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to process the payroll entry right now."
    });
  }
}
