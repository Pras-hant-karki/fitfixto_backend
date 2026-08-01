import { Schema, model, Document, Types } from 'mongoose';

export interface ITrainerProgram extends Document {
  _id: Types.ObjectId;
  trainerId: Types.ObjectId;
  title: string;
  description?: string;
  programType: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  image?: string | null;
  durationWeeks: number;
  sessions: number;
  price: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const trainerProgramSchema = new Schema<ITrainerProgram>(
  {
    trainerId: {
      type: Schema.Types.ObjectId,
      ref: 'Trainer',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Program title is required'],
      trim: true,
      maxlength: [100, 'Program title must be at most 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Program description must be at most 500 characters'],
    },
    programType: {
      type: String,
      required: true,
      trim: true,
      maxlength: [50, 'Program type must be at most 50 characters'],
      default: '1-on-1',
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    image: {
      type: String,
      default: null,
    },
    durationWeeks: {
      type: Number,
      required: true,
      min: [1, 'Duration must be at least 1 week'],
    },
    sessions: {
      type: Number,
      required: true,
      min: [1, 'Sessions must be at least 1'],
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Program price cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const TrainerProgram = model<ITrainerProgram>('TrainerProgram', trainerProgramSchema);

export default TrainerProgram;
