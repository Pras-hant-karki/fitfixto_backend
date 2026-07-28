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

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type AnalyticsRange = 'today' | 'weekly' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly';

type BucketUnit = 'hour' | 'day' | 'week' | 'month';

const rangeConfig: Record<AnalyticsRange, { unit: BucketUnit; buckets: number }> = {
  today: { unit: 'hour', buckets: 24 },
  weekly: { unit: 'day', buckets: 7 },
  monthly: { unit: 'day', buckets: 30 },
  quarterly: { unit: 'week', buckets: 13 },
  'half-yearly': { unit: 'month', buckets: 6 },
  yearly: { unit: 'month', buckets: 12 },
};

interface AnalyticsBucket {
  label: string;
  /** Inclusive lower bound. */
  start: Date;
  /** Exclusive upper bound. */
  end: Date;
  revenue: number;
  orders: number;
}

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

/** Month arithmetic that never overflows (adding a month to Jan 31 yields Feb 1, not Mar 3). */
const startOfMonth = (date: Date, monthOffset = 0) =>
  new Date(date.getFullYear(), date.getMonth() + monthOffset, 1, 0, 0, 0, 0);

const formatBucketLabel = (date: Date, unit: BucketUnit, range: AnalyticsRange) => {
  if (unit === 'hour') return `${date.getHours().toString().padStart(2, '0')}:00`;
  if (unit === 'week') return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (unit === 'month') {
    // A 12-month window spans two calendar years, so the year keeps the labels unambiguous.
    return range === 'yearly'
      ? date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      : date.toLocaleDateString('en-US', { month: 'short' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Builds contiguous, half-open [start, end) buckets ending with the period that contains now.
 *
 * Buckets carry explicit boundaries rather than formatted labels because matching orders by
 * label text silently dropped data: a six-month window labelled Jan–Jun excluded every order
 * placed in the current month, and a twelve-month window collided the current month with the
 * same month a year earlier.
 */
const buildBuckets = (range: AnalyticsRange): AnalyticsBucket[] => {
  const { unit, buckets: count } = rangeConfig[range];
  const now = new Date();

  return Array.from({ length: count }, (_, index) => {
    const stepsBack = count - 1 - index;
    let start: Date;
    let end: Date;

    if (unit === 'hour') {
      start = startOfDay(now);
      start.setHours(index);
      end = new Date(start);
      end.setHours(start.getHours() + 1);
    } else if (unit === 'day') {
      start = startOfDay(now);
      start.setDate(start.getDate() - stepsBack);
      end = new Date(start);
      end.setDate(start.getDate() + 1);
    } else if (unit === 'week') {
      start = startOfDay(now);
      start.setDate(start.getDate() - stepsBack * 7);
      end = new Date(start);
      end.setDate(start.getDate() + 7);
    } else {
      start = startOfMonth(now, -stepsBack);
      end = startOfMonth(start, 1);
    }

    return { label: formatBucketLabel(start, unit, range), start, end, revenue: 0, orders: 0 };
  });
};

const getRangeStart = (range: AnalyticsRange) => buildBuckets(range)[0].start;

const listUsers = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const { page, limit, search } = req.query as { page?: string; limit?: string; search?: string };
  const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const filter: Record<string, unknown> = {};
  if (search?.trim()) {
    const regex = new RegExp(escapeRegExp(search.trim()), 'i');
    filter.$or = [
      { firstName: regex },
      { lastName: regex },
      { email: regex },
      { phone: regex },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    User.countDocuments(filter),
  ]);

  const userIds = users.map((u) => u._id);
  const orderStats = await Order.aggregate([
    { $match: { userId: { $in: userIds } } },
    { $group: { _id: '$userId', ordersCount: { $sum: 1 }, totalSpent: { $sum: '$totalAmount' } } },
  ]);

  const statsByUserId = new Map(
    orderStats.map((stat) => [
      stat._id.toString(),
      { ordersCount: stat.ordersCount, totalSpent: Math.round((stat.totalSpent || 0) * 100) / 100 },
    ])
  );

  const usersWithStats = users.map((user) => {
    const userObject = user.toObject();
    const stats = statsByUserId.get(user._id.toString()) || { ordersCount: 0, totalSpent: 0 };
    return { ...userObject, password: undefined, ordersCount: stats.ordersCount, totalSpent: stats.totalSpent };
  });

  return sendSuccess(
    res,
    'Users fetched successfully',
    {
      users: usersWithStats,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1,
      },
    },
    HTTP_STATUS.OK
  ) as any;
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

  const [orders, trainers, customerCount] = await Promise.all([
    Order.find({
      createdAt: { $gte: startDate },
      $or: [
        { status: 'delivered' },
        { paymentStatus: 'completed' },
      ],
      status: { $ne: 'returned' },
      paymentStatus: { $ne: 'refunded' },
    }).sort({ createdAt: 1 }),
    Trainer.find({ isSuspended: false }).populate('userId', 'firstName lastName profilePicture'),
    User.countDocuments({ role: UserRole.CUSTOMER }),
  ]);

  const buckets = buildBuckets(range);
  const productTotals = new Map<string, { name: string; sold: number; revenue: number }>();

  const findBucket = (date: Date) => {
    const time = new Date(date).getTime();
    return buckets.find((bucket) => time >= bucket.start.getTime() && time < bucket.end.getTime());
  };

  orders.forEach((order) => {
    const bucket = findBucket(order.createdAt);

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
    customerCount,
  };

  return sendSuccess(
    res,
    'Analytics fetched successfully',
    {
      range,
      summary,
      series: buckets.map((bucket) => ({
        label: bucket.label,
        orders: bucket.orders,
        revenue: Math.round(bucket.revenue * 100) / 100,
      })),
      topProducts,
      topTrainers,
    },
    HTTP_STATUS.OK
  ) as any;
});

export { listUsers, updateUserStatus, deleteUser, getAnalytics };
