import nodemailer from 'nodemailer';
import env from '../config/env';
import { getMailer } from '../config/nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    const mailer = getMailer();

    const mailOptions = {
      from: env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || '',
    };

    await mailer.sendMail(mailOptions);
    console.info(`Email sent to ${options.to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

const sendEmailVerificationEmail = async (
  email: string,
  verificationToken: string,
  frontendUrl: string
): Promise<void> => {
  const verificationLink = `${frontendUrl.replace(/\/$/, '')}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #007bff;">Verify Your Email</h2>
          <p>Welcome to FitFIXto! Please verify your email address to complete your registration.</p>
          <p>
            <a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
              Verify Email
            </a>
          </p>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationLink}</p>
          <p style="color: #888; font-size: 12px;">This link expires in 24 hours.</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: 'Verify Your FitFIXto Email',
    html,
    text: `Verify your email: ${verificationLink}`,
  });
};

const sendWelcomeEmail = async (firstName: string, email: string): Promise<void> => {
  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #007bff;">Welcome to FitFIXto, ${firstName}!</h2>
          <p>Thank you for registering. Your account has been created successfully.</p>
          <p>You can now explore our fitness marketplace, book trainers, and discover premium gym equipment.</p>
          <p>If you have any questions, please contact our support team.</p>
          <p>Happy fitness journey!</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: 'Welcome to FitFIXto',
    html,
    text: `Welcome to FitFIXto, ${firstName}!`,
  });
};

const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
  frontendUrl: string
): Promise<void> => {
  const resetLink = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${resetToken}`;

  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #007bff;">Reset Your Password</h2>
          <p>We received a request to reset your password. Click the link below to proceed:</p>
          <p>
            <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
              Reset Password
            </a>
          </p>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetLink}</p>
          <p style="color: #888; font-size: 12px;">This link expires in 1 hour.</p>
          <p style="color: #888; font-size: 12px;">If you did not request this, please ignore this email.</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: 'Reset Your FitFIXto Password',
    html,
    text: `Reset your password: ${resetLink}`,
  });
};

export {
  sendEmail,
  sendEmailVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
};

const sendTrainerCredentialsEmail = async (email: string, password: string): Promise<void> => {
  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #007bff;">FitFIXto Trainer Login Password</h2>
          <p>Your trainer account has been created.</p>
          <p><strong>Password:</strong> ${password}</p>
          <p>Please log in with your email and this password, then change your password from your profile.</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: 'Your FitFIXto Trainer Password',
    html,
    text: `Password: ${password}`,
  });
};

export { sendTrainerCredentialsEmail };

const sendOrderConfirmationEmail = async (email: string, order: any, baseUrl?: string): Promise<void> => {
  const orderUrl = baseUrl ? `${baseUrl}/orders/${order._id}` : '';

  const itemsHtml = (order.items || [])
    .map(
      (it: any) => `<li>${it.productName} — Qty: ${it.quantity} — Price: ${it.unitPrice}</li>`
    )
    .join('');

  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #007bff;">Order Confirmation — ${order._id}</h2>
          <p>Thank you for your order! Here are the details:</p>
          <ul>${itemsHtml}</ul>
          <p><strong>Subtotal:</strong> ${order.subtotal}</p>
          <p><strong>Discount:</strong> ${order.discountAmount}</p>
          <p><strong>Total:</strong> ${order.totalAmount}</p>
          ${orderUrl ? `<p>Track your order: <a href="${orderUrl}">${orderUrl}</a></p>` : ''}
          <p style="color: #888; font-size: 12px;">If you have any questions, reply to this email.</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `Order Confirmation — ${order._id}`,
    html,
    text: `Order ${order._id} confirmed. Total: ${order.totalAmount}`,
  });
};

type OrderNotificationStatus = 'cancelled' | 'shipped' | 'delivered';

const orderNotificationCopy: Record<OrderNotificationStatus, { subject: string; heading: string; body: string }> = {
  cancelled: {
    subject: 'Your FitFIXto order was cancelled',
    heading: 'Order Cancelled',
    body: 'Your order has been cancelled. If payment was collected, our team will follow up about the refund process.',
  },
  shipped: {
    subject: 'Your FitFIXto order has shipped',
    heading: 'Order Shipped',
    body: 'Good news. Your order is on the way.',
  },
  delivered: {
    subject: 'Your FitFIXto order was delivered',
    heading: 'Order Delivered',
    body: 'Your order has been marked as delivered. Thank you for shopping with FitFIXto.',
  },
};

const sendOrderStatusEmail = async (
  email: string,
  order: any,
  status: OrderNotificationStatus
): Promise<void> => {
  const copy = orderNotificationCopy[status];
  const orderId = String(order._id);

  const itemsHtml = (order.items || [])
    .map((item: any) => `<li>${item.productName} - Qty: ${item.quantity} - Price: ${item.unitPrice}</li>`)
    .join('');

  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #007bff;">${copy.heading}</h2>
          <p>${copy.body}</p>
          <p><strong>Order:</strong> ${orderId}</p>
          ${itemsHtml ? `<ul>${itemsHtml}</ul>` : ''}
          <p><strong>Total:</strong> ${order.totalAmount}</p>
          <p><strong>Status:</strong> ${status}</p>
          <p style="color: #888; font-size: 12px;">If you have any questions, reply to this email.</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `${copy.subject} - ${orderId}`,
    html,
    text: `${copy.heading}. Order ${orderId}. Total: ${order.totalAmount}. Status: ${status}.`,
  });
};

const sendOrderCancelledEmail = (email: string, order: any): Promise<void> =>
  sendOrderStatusEmail(email, order, 'cancelled');

const sendOrderShippedEmail = (email: string, order: any): Promise<void> =>
  sendOrderStatusEmail(email, order, 'shipped');

const sendOrderDeliveredEmail = (email: string, order: any): Promise<void> =>
  sendOrderStatusEmail(email, order, 'delivered');

export { sendOrderConfirmationEmail, sendOrderCancelledEmail, sendOrderShippedEmail, sendOrderDeliveredEmail };
