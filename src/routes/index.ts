import { Router } from 'express';
import healthRouter from './health.route';
import adminRouter from './admin.route';
import authRouter from './auth.route';
import deliveryAddressRouter from './deliveryAddress.route';
import productRouter from './product.route';
import trainerRouter from './trainer.route';
import homepageRouter from './homepage.route';
import orderRouter from './order.route';
import reviewRouter from './review.route';
import cartRouter from './cart.route';
import wishlistRouter from './wishlist.route';
import voucherRouter from './voucher.route';
import paymentRouter from './payment.route';
import partnerGymRouter from './partnerGym.route';
import bookingRouter from './booking.route';
import serviceRouter from './service.route';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/delivery-addresses', deliveryAddressRouter);
apiRouter.use('/products', productRouter);
apiRouter.use('/trainers', trainerRouter);
apiRouter.use('/homepage', homepageRouter);
apiRouter.use('/orders', orderRouter);
apiRouter.use('/reviews', reviewRouter);
apiRouter.use('/cart', cartRouter);
apiRouter.use('/wishlist', wishlistRouter);
apiRouter.use('/vouchers', voucherRouter);
apiRouter.use('/payments', paymentRouter);
apiRouter.use('/partner-gyms', partnerGymRouter);
apiRouter.use('/bookings', bookingRouter);
apiRouter.use('/services', serviceRouter);

export default apiRouter;
