import { Schema, model, Document, Types } from 'mongoose';

export interface ITrainerAvailableDate extends Document {
  trainerId: Types.ObjectId;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const trainerAvailableDateSchema = new Schema<ITrainerAvailableDate>(
  {
    trainerId: { type: Schema.Types.ObjectId, ref: 'Trainer', required: true, index: true },
    date: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

trainerAvailableDateSchema.index({ trainerId: 1, date: 1 }, { unique: true });

export default model<ITrainerAvailableDate>('TrainerAvailableDate', trainerAvailableDateSchema);
