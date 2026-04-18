import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    technicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Technician"
    },
    technicianName: {
      type: String,
      required: true,
      trim: true
    },
    payType: {
      type: String,
      enum: ["hourly", "salary"],
      default: "salary"
    },
    date: {
      type: String,
      required: true
    },
    customer: {
      type: String,
      required: true,
      trim: true
    },
    issue: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      required: true,
      trim: true
    },
    dispatchTime: {
      type: String,
      required: true
    },
    etaToHours: {
      type: Number,
      default: 0
    },
    etaToMinutes: {
      type: Number,
      default: 0
    },
    arrivalTime: {
      type: String,
      required: true
    },
    finishedTime: {
      type: String,
      required: true
    },
    etaFromHours: {
      type: Number,
      default: 0
    },
    etaFromMinutes: {
      type: Number,
      default: 0
    },
    etaFromDestination: {
      type: String,
      enum: ["home", "next_job"],
      default: "home"
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    createdByName: String,
    createdByUsername: String
  },
  { timestamps: true }
);

export default mongoose.models.Job || mongoose.model("Job", jobSchema);
