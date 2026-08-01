import { Schema, model, Document, Types } from 'mongoose';

export interface IProductDimensions {
  length?: number;
  width?: number;
  height?: number;
}

export interface IProduct extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  specifications?: string;
  importedFrom?: string;
  warrantyMonths?: number;
  price: number;
  stock: number;
  category: string;
  subcategory?: string;
  brand?: string;
  images: string[];
  tags?: string[];
  sku?: string;
  discountPercentage?: number;
  weight?: number;
  weightUnit?: 'gm' | 'kg';
  dimensions?: IProductDimensions;
  isFeatured: boolean;
  isActive: boolean;
  verifiedBadge: boolean;
  averageRating: number;
  ratingCount: number;
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
    specifications: {
      type: String,
      trim: true,
      maxlength: [2000, 'Specifications must be at most 2000 characters'],
    },
    importedFrom: {
      type: String,
      trim: true,
      maxlength: [2000, 'Imported from must be at most 2000 characters'],
    },
    warrantyMonths: {
      type: Number,
      min: [0, 'Warranty cannot be negative'],
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
      required: [true, 'Product category is required'],
      trim: true,
      maxlength: [100, 'Product category must be at most 100 characters'],
    },
    subcategory: {
      type: String,
      trim: true,
      maxlength: [100, 'Subcategory must be at most 100 characters'],
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
    weightUnit: {
      type: String,
      enum: ['gm', 'kg'],
      default: 'kg',
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
    averageRating: {
      type: Number,
      min: [0, 'Average rating must be at least 0'],
      max: [5, 'Average rating cannot exceed 5'],
      default: 0,
    },
    ratingCount: {
      type: Number,
      min: [0, 'Rating count cannot be negative'],
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Product = model<IProduct>('Product', productSchema);

export default Product;
