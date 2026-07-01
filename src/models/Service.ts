import { Schema, model, Document, Types } from 'mongoose';

export interface IService extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  priceLabel: string;
  charge: number;
  features: string[];
  image?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<IService>(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      minlength: [2, 'Service name must be at least 2 characters'],
      maxlength: [150, 'Service name must be at most 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Service description is required'],
      trim: true,
      minlength: [5, 'Description must be at least 5 characters'],
      maxlength: [500, 'Description must be at most 500 characters'],
    },
    priceLabel: {
      type: String,
      trim: true,
      maxlength: [100, 'Price label must be at most 100 characters'],
      default: '',
    },
    charge: {
      type: Number,
      min: [0, 'Charge cannot be negative'],
      default: 0,
    },
    features: {
      type: [String],
      default: [],
      validate: {
        validator: (features: string[]) => features.length <= 20,
        message: 'A service can have at most 20 features',
      },
    },
    image: {
      type: String,
      trim: true,
      maxlength: [1000, 'Image URL must be at most 1000 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Service = model<IService>('Service', serviceSchema);

export default Service;
