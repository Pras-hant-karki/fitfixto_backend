import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { RequestWithUser } from '../middlewares/auth';
import User from '../models/User';
import Order from '../models/Order';
import Trainer from '../models/Trainer';
import { UserRole } from '../types/index';

type AnalyticsRange = 'today' | 'weekly' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly';

const rangeConfig: Record<AnalyticsRange, { days: number; buckets: number; label: string }> = {
  today: { days: 1, buckets: 24, label: 'hour' },
  weekly: { days: 7, buckets: 7, label: 'day' },
  monthly: { days: 30, buckets: 30, label: 'day' },
  quarterly: { days: 90, buckets: 13, label: 'week' },
  'half-yearly': { days: 182, buckets: 6, label: 'month' },
  yearly: { days: 365, buckets: 12, label: 'month' },
};

const getRangeStart = (range: AnalyticsRange) => {
  const config = rangeConfig[range];
  const start = new Date();
  start.setDate(start.getDate() - config.days + 1);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getBucketKey = (date: Date, range: AnalyticsRange) => {
  if (range === 'today') {
    return `${date.getHours().toString().padStart(2, '0')}:00`;
  }

  if (range === 'weekly') {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  if (range === 'monthly') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (range === 'quarterly') {
    const start = getRangeStart(range);
    const diffDays = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    return `W${Math.floor(diffDays / 7) + 1}`;
  }

  return date.toLocaleDateString('en-US', { month: 'short' });
};

const buildBuckets = (range: AnalyticsRange) => {
  const config = rangeConfig[range];
  const start = getRangeStart(range);

  return Array.from({ length: config.buckets }, (_, index) => {
    const date = new Date(start);

    if (range === 'today') {
      date.setHours(index, 0, 0, 0);
    } else if (range === 'weekly' || range === 'monthly') {
      date.setDate(start.getDate() + index);
    } else if (range === 'quarterly') {
      date.setDate(start.getDate() + index * 7);
    } else {
      date.setMonth(start.getMonth() + index);
    }

    return {
      label: getBucketKey(date, range),
      revenue: 0,
      orders: 0,
    };
  });
};

const listUsers = asyncHandler(async (_req: RequestWithUser, res: Response): Promise<void> => {
  const [users, orderStats] = await Promise.all([
    User.find().sort({ createdAt: -1 }),
    Order.aggregate([
      {
        $group: {
          _id: '$userId',
          ordersCount: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
        },
      },
    ]),
  ]);

  const statsByUserId = new Map(
    orderStats.map((stat) => [
      stat._id.toString(),
      {
        ordersCount: stat.ordersCount,
        totalSpent: Math.round((stat.totalSpent || 0) * 100) / 100,
      },
    ])
  );

  const usersWithStats = users.map((user) => {
    const userObject = user.toObject();
    const stats = statsByUserId.get(user._id.toString()) || { ordersCount: 0, totalSpent: 0 };

    return {
      ...userObject,
      password: undefined,
      ordersCount: stats.ordersCount,
      totalSpent: stats.totalSpent,
    };
  });

  return sendSuccess(res, 'Users fetched successfully', { users: usersWithStats }, HTTP_STATUS.OK) as any;
});

const updateUserStatus = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const { userId } = req.params;
  const { isActive } = req.body as { isActive?: boolean };

  if (typeof isActive !== 'boolean') {
    throw new AppError('isActive must be a boolean', HTTP_STATUS.BAD_REQUEST);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  if (user.role === UserRole.ADMIN) {
    throw new AppError('Admin accounts cannot be suspended from this page', HTTP_STATUS.BAD_REQUEST);
  }

  user.isActive = isActive;
  await user.save();

  return sendSuccess(res, 'User status updated successfully', { user }, HTTP_STATUS.OK) as any;
});

const deleteUser = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  if (user.role === UserRole.ADMIN) {
    throw new AppError('Admin accounts cannot be deleted from this page', HTTP_STATUS.BAD_REQUEST);
  }

  await User.findByIdAndDelete(userId);

  return sendSuccess(res, 'User deleted successfully', { userId }, HTTP_STATUS.OK) as any;
});

const getAnalytics = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const requestedRange = String(req.query.range || 'yearly') as AnalyticsRange;
  const range: AnalyticsRange = requestedRange in rangeConfig ? requestedRange : 'yearly';
  const startDate = getRangeStart(range);

  const [orders, trainers] = await Promise.all([
    Order.find({ createdAt: { $gte: startDate }, status: 'delivered' }).sort({ createdAt: 1 }),
    Trainer.find({ isSuspended: false }).populate('userId', 'firstName lastName profilePicture'),
  ]);

  const buckets = buildBuckets(range);
  const bucketMap = new Map(buckets.map((bucket) => [bucket.label, bucket]));
  const productTotals = new Map<string, { name: string; sold: number; revenue: number }>();

  orders.forEach((order) => {
    const label = getBucketKey(order.createdAt, range);
    const bucket = bucketMap.get(label);

    if (bucket) {
      bucket.revenue += order.totalAmount;
      bucket.orders += 1;
    }

    order.items.forEach((item) => {
      const key = item.productId.toString();
      const current = productTotals.get(key) || { name: item.productName, sold: 0, revenue: 0 };
      current.sold += item.quantity;
      current.revenue += item.lineTotal;
      productTotals.set(key, current);
    });
  });

  const topProducts = Array.from(productTotals.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((product) => ({
      ...product,
      revenue: Math.round(product.revenue * 100) / 100,
    }));

  const topTrainers = trainers
    .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.experienceYears - a.experienceYears)
    .slice(0, 5)
    .map((trainer) => {
      const user = trainer.userId as unknown as { firstName: string; lastName: string; profilePicture?: string };
      return {
        id: trainer._id,
        name: `${user.firstName} ${user.lastName}`,
        specialty: trainer.specialties.join(' · ') || 'Trainer',
        profilePicture: user.profilePicture || null,
        experienceYears: trainer.experienceYears,
        sessionRate: trainer.sessionRate,
      };
    });

  const summary = {
    revenue: Math.round(orders.reduce((sum, order) => sum + order.totalAmount, 0) * 100) / 100,
    orders: orders.length,
    averageOrderValue: orders.length ? Math.round((orders.reduce((sum, order) => sum + order.totalAmount, 0) / orders.length) * 100) / 100 : 0,
    productsSold: Array.from(productTotals.values()).reduce((sum, product) => sum + product.sold, 0),
  };

  return sendSuccess(
    res,
    'Analytics fetched successfully',
    {
      range,
      summary,
      series: buckets.map((bucket) => ({
        ...bucket,
        revenue: Math.round(bucket.revenue * 100) / 100,
      })),
      topProducts,
      topTrainers,
    },
    HTTP_STATUS.OK
  ) as any;
});

export { listUsers, updateUserStatus, deleteUser, getAnalytics };
