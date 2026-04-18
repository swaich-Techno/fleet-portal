import mongoose from "mongoose";

const technicianSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    payType: {
      type: String,
      enum: ["hourly", "salary"],
      default: "salary"
    },
    active: {
      type: Boolean,
      default: true
    },
    sortOrder: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

technicianSchema.index({ name: 1 }, { unique: true });

export default mongoose.models.Technician ||
  mongoose.model("Technician", technicianSchema);
