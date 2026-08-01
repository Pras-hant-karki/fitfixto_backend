export enum UserRole {
  CUSTOMER = 'customer',
  TRAINER = 'trainer',
  ADMIN = 'admin',
}

export enum ProductCategory {
  STRENGTH_EQUIPMENT = 'strength_equipment',
  CARDIO_EQUIPMENT = 'cardio_equipment',
  FUNCTIONAL_TRAINING = 'functional_training',
  ACCESSORIES = 'accessories',
  SUPPLEMENTS = 'supplements',
  RECOVERY_MOBILITY = 'recovery_mobility',
  GYM_EQUIPMENT = 'gym_equipment',
}

export enum ServiceType {
  TRAINER_BOOKING = 'trainer_booking',
  GYM_SETUP = 'gym_setup',
  MAINTENANCE = 'maintenance',
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  CASH_ON_DELIVERY = 'cash_on_delivery',
  ESEWA = 'esewa',
  KHALTI = 'khalti',
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: unknown;
}
