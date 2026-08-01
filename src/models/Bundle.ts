import { Schema, model, Document, Types } from 'mongoose';

export interface IBundle extends Document {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  productIds: Types.ObjectId[];
  discountPercentage: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const bundleSchema = new Schema<IBundle>(
  {
    title: {
      type: String,
      required: [true, 'Bundle title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [150, 'Title must be at most 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description must be at most 300 characters'],
    },
    productIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
      validate: {
        validator: (ids: Types.ObjectId[]) => ids.length >= 2,
        message: 'A bundle must contain at least 2 products',
      },
    },
    discountPercentage: {
      type: Number,
      required: [true, 'Discount percentage is required'],
      min: [1, 'Discount must be at least 1%'],
      max: [99, 'Discount cannot exceed 99%'],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Bundle = model<IBundle>('Bundle', bundleSchema);

export default Bundle;
