import nodemailer from 'nodemailer';
import env from './env';

let transporter: nodemailer.Transporter | null = null;

const initializeMailer = (): nodemailer.Transporter => {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_PORT === 465,
    auth: {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASSWORD || env.EMAIL_PASS,
    },
  });

  return transporter;
};

const getMailer = (): nodemailer.Transporter => {
  if (!transporter) {
    return initializeMailer();
  }
  return transporter;
};

const verifyConnection = async (): Promise<void> => {
  try {
    const mailer = getMailer();
    await mailer.verify();
    console.log('Nodemailer connection verified');
  } catch (error) {
    console.error('Nodemailer connection error:', error);
    throw error;
  }
};

export { initializeMailer, getMailer, verifyConnection };
