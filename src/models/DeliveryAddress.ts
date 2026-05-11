import { Schema, model, Document, Types } from 'mongoose';

export interface IDeliveryAddress extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const deliveryAddressSchema = new Schema<IDeliveryAddress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    recipientName: {
      type: String,
      required: [true, 'Recipient name is required'],
      trim: true,
      minlength: [2, 'Recipient name must be at least 2 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, 'Please provide a valid phone number'],
    },
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true,
      minlength: [5, 'Street address must be at least 5 characters'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      minlength: [2, 'City must be at least 2 characters'],
    },
    state: {
      type: String,
      required: [true, 'State/Province is required'],
      trim: true,
      minlength: [2, 'State must be at least 2 characters'],
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
      trim: true,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const DeliveryAddress = model<IDeliveryAddress>('DeliveryAddress', deliveryAddressSchema);

export default DeliveryAddress;
