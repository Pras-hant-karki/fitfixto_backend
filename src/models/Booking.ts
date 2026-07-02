import { Schema, model, Document, Types } from 'mongoose';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type BookingSessionType = 'single' | 'five_pack' | 'ten_pack';
export type BookingPaymentMethod = 'esewa' | 'khalti' | 'card' | 'cash';

export interface IBooking extends Document {
  _id: Types.ObjectId;
  clientId: Types.ObjectId;
  trainerId: Types.ObjectId;
  slotDate: Date;
  timeLabel: string;
  sessionType: BookingSessionType;
  sessionCount: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  paymentMethod: BookingPaymentMethod;
  subtotal: number;
  serviceFee: number;
  totalAmount: number;
  status: BookingStatus;
  notes?: string;
  trainerNotes?: string;
  clientRating?: number;
  clientComment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    trainerId: {
      type: Schema.Types.ObjectId,
      ref: 'Trainer',
      required: true,
      index: true,
    },
    slotDate: {
      type: Date,
      required: [true, 'Slot date is required'],
    },
    timeLabel: {
      type: String,
      required: [true, 'Time slot is required'],
      trim: true,
      maxlength: [30, 'Time label must be at most 30 characters'],
    },
    sessionType: { type: String, enum: ['single', 'five_pack', 'ten_pack'], default: 'single' },
    sessionCount: { type: Number, min: 1, default: 1 },
    contactName: { type: String, required: true, trim: true, maxlength: 120 },
    contactEmail: { type: String, required: true, trim: true, lowercase: true },
    contactPhone: { type: String, required: true, trim: true },
    paymentMethod: { type: String, enum: ['esewa', 'khalti', 'card', 'cash'], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    serviceFee: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes must be at most 500 characters'],
    },
    trainerNotes: {
      type: String,
      trim: true,
      maxlength: [500, 'Trainer notes must be at most 500 characters'],
    },
    clientRating: { type: Number, min: 1, max: 5 },
    clientComment: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

bookingSchema.index(
  { trainerId: 1, slotDate: 1, timeLabel: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } } }
);

const Booking = model<IBooking>('Booking', bookingSchema);

export default Booking;
