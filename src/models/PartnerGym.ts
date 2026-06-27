import { Schema, model, Document, Types } from 'mongoose';

export interface IPartnerGym extends Document {
  _id: Types.ObjectId;
  name: string;
  address: string;
  phone?: string;
  hours?: string;
  rating?: number;
  pin?: string;
  locationUrl?: string;
  imageUrl?: string;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const partnerGymSchema = new Schema<IPartnerGym>(
  {
    name: {
      type: String,
      required: [true, 'Gym name is required'],
      trim: true,
      minlength: [2, 'Gym name must be at least 2 characters'],
      maxlength: [150, 'Gym name must be at most 150 characters'],
    },
    address: {
      type: String,
      required: [true, 'Gym address is required'],
      trim: true,
      minlength: [2, 'Gym address must be at least 2 characters'],
      maxlength: [300, 'Gym address must be at most 300 characters'],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [50, 'Phone must be at most 50 characters'],
    },
    hours: {
      type: String,
      trim: true,
      maxlength: [80, 'Hours must be at most 80 characters'],
    },
    rating: {
      type: Number,
      min: [0, 'Rating cannot be below 0'],
      max: [5, 'Rating cannot exceed 5'],
    },
    pin: {
      type: String,
      trim: true,
      maxlength: [80, 'Pin must be at most 80 characters'],
    },
    locationUrl: {
      type: String,
      trim: true,
      maxlength: [1000, 'Location URL must be at most 1000 characters'],
    },
    imageUrl: {
      type: String,
      trim: true,
      maxlength: [1000, 'Image URL must be at most 1000 characters'],
    },
    isVisible: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const PartnerGym = model<IPartnerGym>('PartnerGym', partnerGymSchema);

export default PartnerGym;
