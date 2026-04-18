import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["admin", "editor", "viewer"],
      default: "viewer"
    },
    requestedRole: {
      type: String,
      enum: ["admin", "editor", "viewer"],
      default: "viewer"
    },
    status: {
      type: String,
      enum: ["approved", "pending", "suspended"],
      default: "pending"
    },
    approvedAt: Date,
    lastLoginAt: Date
  },
  { timestamps: true }
);

userSchema.index({ username: 1 }, { unique: true });

export default mongoose.models.User || mongoose.model("User", userSchema);
