import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { RequestWithUser } from '../middlewares/auth';
import User from '../models/User';
import Order from '../models/Order';
import { UserRole } from '../types/index';

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

export { listUsers, updateUserStatus, deleteUser };
