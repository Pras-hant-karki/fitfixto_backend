import { Schema, model, Document, Types } from 'mongoose';

export type TrainerAvailabilityDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface ITrainerAvailability extends Document {
  _id: Types.ObjectId;
  trainerId: Types.ObjectId;
  dayOfWeek: TrainerAvailabilityDay;
  timeLabel: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const trainerAvailabilitySchema = new Schema<ITrainerAvailability>(
  {
    trainerId: {
      type: Schema.Types.ObjectId,
      ref: 'Trainer',
      required: true,
      index: true,
    },
    dayOfWeek: {
      type: String,
      enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      required: true,
      index: true,
    },
    timeLabel: {
      type: String,
      required: [true, 'Time is required'],
      trim: true,
      maxlength: [30, 'Time must be at most 30 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

trainerAvailabilitySchema.index({ trainerId: 1, dayOfWeek: 1, timeLabel: 1 }, { unique: true });

const TrainerAvailability = model<ITrainerAvailability>('TrainerAvailability', trainerAvailabilitySchema);

export default TrainerAvailability;
