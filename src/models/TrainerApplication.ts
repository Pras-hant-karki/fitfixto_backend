import { Schema, model, Document, Types } from 'mongoose';

export type TrainerApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface ITrainerApplication extends Document {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  location?: string;
  sessionRate: number;
  experienceYears: number;
  specialties: string[];
  certifications: string[];
  certificationFiles: string[];
  bio?: string;
  profilePicture?: string | null;
  status: TrainerApplicationStatus;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  createdTrainerId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const trainerApplicationSchema = new Schema<ITrainerApplication>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      minlength: [2, 'First name must be at least 2 characters'],
      maxlength: [50, 'First name must be at most 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      minlength: [2, 'Last name must be at least 2 characters'],
      maxlength: [50, 'Last name must be at most 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
      maxlength: [120, 'Location must be at most 120 characters'],
    },
    sessionRate: {
      type: Number,
      min: [0, 'Session rate cannot be negative'],
      default: 0,
    },
    experienceYears: {
      type: Number,
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
    certificationFiles: {
      type: [String],
      default: [],
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, 'Bio must be at most 500 characters'],
    },
    profilePicture: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewedAt: Date,
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    createdTrainerId: {
      type: Schema.Types.ObjectId,
      ref: 'Trainer',
    },
  },
  { timestamps: true }
);

const TrainerApplication = model<ITrainerApplication>('TrainerApplication', trainerApplicationSchema);

export default TrainerApplication;
