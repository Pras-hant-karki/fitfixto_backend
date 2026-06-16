import { Schema, model, Document, Types } from 'mongoose';

export interface IHomepageHero {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaLink: string;
  imageUrl: string;
  eyebrowFontSize: number;
  titleFontSize: number;
  subtitleFontSize: number;
  ctaFontSize: number;
}

export interface IHomepagePromotionalBanner {
  text: string;
  link: string;
  isVisible: boolean;
  fontSize: number;
}

export interface IHomepageSettings extends Document {
  _id: Types.ObjectId;
  hero: IHomepageHero;
  promotionalBanner: IHomepagePromotionalBanner;
  createdAt: Date;
  updatedAt: Date;
}

const homepageHeroSchema = new Schema<IHomepageHero>(
  {
    eyebrow: { type: String, default: '', trim: true },
    title: { type: String, default: 'Built for Strength', trim: true },
    subtitle: {
      type: String,
      default: 'Premium equipment, expert installation, and professional trainers for serious results.',
      trim: true,
    },
    ctaLabel: { type: String, default: 'Shop Equipment', trim: true },
    ctaLink: { type: String, default: '#shop', trim: true },
    imageUrl: { type: String, default: '/home-hero-gym.png', trim: true },
    eyebrowFontSize: { type: Number, default: 14, min: 8, max: 32 },
    titleFontSize: { type: Number, default: 72, min: 16, max: 72 },
    subtitleFontSize: { type: Number, default: 24, min: 10, max: 36 },
    ctaFontSize: { type: Number, default: 18, min: 10, max: 28 },
  },
  { _id: false }
);

const homepagePromotionalBannerSchema = new Schema<IHomepagePromotionalBanner>(
  {
    text: { type: String, default: 'Free shipping inside Kathmandu Valley over Npr 5,000', trim: true },
    link: { type: String, default: '/shop', trim: true },
    isVisible: { type: Boolean, default: true },
    fontSize: { type: Number, default: 16, min: 10, max: 36 },
  },
  { _id: false }
);

const homepageSettingsSchema = new Schema<IHomepageSettings>(
  {
    hero: {
      type: homepageHeroSchema,
      default: () => ({}),
    },
    promotionalBanner: {
      type: homepagePromotionalBannerSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

const HomepageSettings = model<IHomepageSettings>('HomepageSettings', homepageSettingsSchema);

export default HomepageSettings;
