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
  baseUrl: string
): Promise<void> => {
  const verificationLink = `${baseUrl}/api/v1/auth/verify-email?token=${verificationToken}`;

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
  baseUrl: string
): Promise<void> => {
  const resetLink = `${baseUrl}/api/v1/auth/reset-password?token=${resetToken}`;

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

export { sendOrderConfirmationEmail };
