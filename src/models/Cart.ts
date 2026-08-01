import { Schema, model, Document, Types } from 'mongoose';

export interface ICartItem {
  productId: Types.ObjectId;
  quantity: number;
  priceAtAdded: number;
}

export interface ICart extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  items: ICartItem[];
  createdAt: Date;
  updatedAt: Date;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      default: 1,
    },
    priceAtAdded: {
      type: Number,
      required: [true, 'Price at added time is required'],
      min: [0, 'Price cannot be negative'],
    },
  },
  {
    _id: false,
  }
);

const cartSchema = new Schema<ICart>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      unique: true,
      index: true,
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Cart = model<ICart>('Cart', cartSchema);

export default Cart;
