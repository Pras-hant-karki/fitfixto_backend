import { OrderStatus } from '../types/index';

/**
 * Calculate estimated delivery date based on order status
 * @param orderDate - The date the order was placed
 * @param status - The current order status
 * @returns Estimated delivery date
 */
export const calculateEstimatedDeliveryDate = (orderDate: Date, status: OrderStatus): Date => {
  const deliveryDate = new Date(orderDate);

  // Delivery time estimates in days
  const deliveryDays = 3; // Standard 3-day delivery for confirmed orders

  // Add delivery days to order date
  deliveryDate.setDate(deliveryDate.getDate() + deliveryDays);

  return deliveryDate;
};

/**
 * Get delivery status timeline with timestamps
 */
export interface DeliveryTimeline {
  status: OrderStatus;
  timestamp?: Date;
  label: string;
}

/**
 * Build delivery timeline for order tracking
 */
export const buildDeliveryTimeline = (
  createdAt: Date,
  status: OrderStatus,
  confirmedAt?: Date,
  shippedAt?: Date,
  deliveredAt?: Date
): DeliveryTimeline[] => {
  const timeline: DeliveryTimeline[] = [
    {
      status: OrderStatus.PENDING,
      timestamp: createdAt,
      label: 'Order Placed',
    },
  ];

  if (confirmedAt) {
    timeline.push({
      status: OrderStatus.CONFIRMED,
      timestamp: confirmedAt,
      label: 'Order Confirmed',
    });
  }

  if (shippedAt) {
    timeline.push({
      status: OrderStatus.SHIPPED,
      timestamp: shippedAt,
      label: 'Shipped',
    });
  }

  if (deliveredAt) {
    timeline.push({
      status: OrderStatus.DELIVERED,
      timestamp: deliveredAt,
      label: 'Delivered',
    });
  }

  return timeline;
};

/**
 * Calculate days remaining until estimated delivery
 */
export const getDaysUntilDelivery = (estimatedDeliveryDate: Date): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const delivery = new Date(estimatedDeliveryDate);
  delivery.setHours(0, 0, 0, 0);

  const timeDiff = delivery.getTime() - today.getTime();
  const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));

  return daysRemaining;
};
