import { Schema, model, Document, Types } from 'mongoose';

interface IFlashSale {
  title: string;
  discountPercentage: number;
  endsAt?: Date | null;
  productIds: Types.ObjectId[];
  isActive: boolean;
}

export interface IDiscountSettings extends Document {
  flashSale: IFlashSale;
  bestPriceProductIds: Types.ObjectId[];
  refundGuarantee: string;
  updatedAt: Date;
}

const discountSettingsSchema = new Schema<IDiscountSettings>(
  {
    flashSale: {
      title: { type: String, trim: true, maxlength: 150, default: '' },
      discountPercentage: { type: Number, min: 0, max: 100, default: 0 },
      endsAt: { type: Date, default: null },
      productIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
      isActive: { type: Boolean, default: false },
    },
    bestPriceProductIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    refundGuarantee: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);

const DiscountSettings = model<IDiscountSettings>('DiscountSettings', discountSettingsSchema);

export default DiscountSettings;
