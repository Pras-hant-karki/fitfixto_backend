import { Schema, model, Document, Types } from 'mongoose';

export interface ITrainer extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  location?: string;
  sessionRate: number;
  experienceYears: number;
  specialties: string[];
  certifications: string[];
  isFeatured: boolean;
  isSuspended: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const trainerSchema = new Schema<ITrainer>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    location: {
      type: String,
      trim: true,
      maxlength: [120, 'Location must be at most 120 characters'],
    },
    sessionRate: {
      type: Number,
      required: true,
      min: [0, 'Session rate cannot be negative'],
      default: 0,
    },
    experienceYears: {
      type: Number,
      required: true,
      min: [0, 'Experience cannot be negative'],
      default: 0,
    },
    specialties: {
      type: [String],
      default: [],
    },
    certifications: {
      type: [String],
      default: [],
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Trainer = model<ITrainer>('Trainer', trainerSchema);

export default Trainer;
