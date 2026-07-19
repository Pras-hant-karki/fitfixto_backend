import { Schema, model, Document, Types } from 'mongoose';
import { OrderStatus, PaymentMethod, PaymentStatus } from '../types/index';

export interface IOrderItem {
  productId: Types.ObjectId;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  items: IOrderItem[];
  deliveryAddressId: Types.ObjectId;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  voucherCode?: string;
  subtotal: number;
  discountAmount: number;
  shippingMethod?: string;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  transactionId?: string;
  stripePaymentIntentId?: string;
  stripeSessionId?: string;
  paidAt?: Date;
  cancellationReason?: string;
  cancelledAt?: Date;
  estimatedDeliveryDate?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      default: [],
    },
    deliveryAddressId: {
      type: Schema.Types.ObjectId,
      ref: 'DeliveryAddress',
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
    },
    voucherCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippingMethod: {
      type: String,
      enum: ['standard', 'express', 'overnight'],
      default: 'standard',
    },
    shippingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      maxlength: 1000,
    },
    transactionId: {
      type: String,
      sparse: true,
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      sparse: true,
      index: true,
    },
    stripeSessionId: {
      type: String,
      sparse: true,
      index: true,
    },
    paidAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      maxlength: 1000,
    },
    cancelledAt: {
      type: Date,
    },
    estimatedDeliveryDate: {
      type: Date,
      index: true,
    },
    deliveredAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

const Order = model<IOrder>('Order', orderSchema);

export default Order;
