import { Schema, model, Document, Types } from 'mongoose';

export type ServiceBookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface IServiceBooking extends Document {
  _id: Types.ObjectId;
  clientId: Types.ObjectId;
  serviceId: Types.ObjectId;
  scheduledDate: Date;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes?: string;
  amount: number;
  status: ServiceBookingStatus;
  adminNotes?: string;
  clientRating?: number;
  clientComment?: string;
  /** Admin moderation of the client's service review, mirroring the product Review model. */
  reviewIsFeatured: boolean;
  reviewModerationStatus: 'approved' | 'removed';
  createdAt: Date;
  updatedAt: Date;
}

const serviceBookingSchema = new Schema<IServiceBooking>(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    scheduledDate: { type: Date, required: [true, 'Scheduled date is required'] },
    contactName: { type: String, required: true, trim: true, maxlength: 120 },
    contactEmail: { type: String, required: true, trim: true, lowercase: true },
    contactPhone: { type: String, required: true, trim: true },
    notes: { type: String, trim: true, maxlength: 500 },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
    },
    adminNotes: { type: String, trim: true, maxlength: 500 },
    clientRating: { type: Number, min: 1, max: 5 },
    clientComment: { type: String, trim: true, maxlength: 500 },
    reviewIsFeatured: { type: Boolean, default: false, index: true },
    reviewModerationStatus: { type: String, enum: ['approved', 'removed'], default: 'approved', index: true },
  },
  { timestamps: true }
);

const ServiceBooking = model<IServiceBooking>('ServiceBooking', serviceBookingSchema);
export default ServiceBooking;
