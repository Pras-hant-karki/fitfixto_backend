import { Schema, model, Document, Types } from 'mongoose';

export interface IReview extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  orderId: Types.ObjectId;
  rating: number;
  title?: string;
  comment?: string;
  isActive: boolean;
  moderationStatus: 'approved' | 'removed';
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    title: {
      type: String,
      trim: true,
      maxlength: [150, 'Review title must be at most 150 characters'],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [2000, 'Review comment must be at most 2000 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    moderationStatus: {
      type: String,
      enum: ['approved', 'removed'],
      default: 'approved',
      index: true,
    },
  },
  { timestamps: true }
);

reviewSchema.index({ userId: 1, productId: 1, orderId: 1 }, { unique: true });

const Review = model<IReview>('Review', reviewSchema);

export default Review;
