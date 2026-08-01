import { Schema, model, Document, Types } from 'mongoose';

export type VoucherType = 'percentage' | 'fixed' | 'bundle';

export interface IBundleSpec {
  productIds: Types.ObjectId[];
  discountPercentage?: number; // percentage applied to matched bundle subtotal
  discountAmount?: number; // fixed amount off the matched bundle subtotal
}

export interface IVoucher extends Document {
  code: string;
  description?: string;
  type: VoucherType;
  amount?: number; // for percentage (0-100) or fixed amount for 'fixed'
  minOrderValue?: number;
  appliesToCategories?: string[];
  appliesToProducts?: Types.ObjectId[];
  bundle?: IBundleSpec;
  usageLimit?: number;
  usedCount: number;
  expiresAt?: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const bundleSchema = new Schema<IBundleSpec>(
  {
    productIds: [{ type: Schema.Types.ObjectId, ref: 'Product', required: true }],
    discountPercentage: { type: Number, min: 0, max: 100 },
    discountAmount: { type: Number, min: 0 },
  },
  { _id: false }
);

const voucherSchema = new Schema<IVoucher>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    description: { type: String },
    type: { type: String, enum: ['percentage', 'fixed', 'bundle'], required: true },
    amount: { type: Number },
    minOrderValue: { type: Number, min: 0 },
    appliesToCategories: { type: [String], default: [] },
    appliesToProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    bundle: { type: bundleSchema },
    usageLimit: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0 },
    expiresAt: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Voucher = model<IVoucher>('Voucher', voucherSchema);

export default Voucher;
