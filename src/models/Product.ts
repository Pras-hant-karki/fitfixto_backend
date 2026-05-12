import { Schema, model, Document, Types } from 'mongoose';
import { ProductCategory } from '../types/index';

export interface IProductDimensions {
  length?: number;
  width?: number;
  height?: number;
}

export interface IProduct extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: ProductCategory;
  brand?: string;
  images: string[];
  tags?: string[];
  sku?: string;
  discountPercentage?: number;
  weight?: number;
  dimensions?: IProductDimensions;
  isFeatured: boolean;
  isActive: boolean;
  verifiedBadge: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must be at least 2 characters'],
      maxlength: [150, 'Product name must be at most 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [2000, 'Description must be at most 2000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be greater than or equal to 0'],
    },
    stock: {
      type: Number,
      required: [true, 'Stock is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    category: {
      type: String,
      enum: Object.values(ProductCategory),
      required: [true, 'Product category is required'],
    },
    brand: {
      type: String,
      trim: true,
      maxlength: [100, 'Brand must be at most 100 characters'],
    },
    images: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    sku: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      maxlength: [100, 'SKU must be at most 100 characters'],
    },
    discountPercentage: {
      type: Number,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100'],
      default: 0,
    },
    weight: {
      type: Number,
      min: [0, 'Weight must be greater than or equal to 0'],
    },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    verifiedBadge: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Product = model<IProduct>('Product', productSchema);

export default Product;