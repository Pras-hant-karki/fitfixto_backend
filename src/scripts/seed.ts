import mongoose from 'mongoose';
import env from '../config/env';
import User from '../models/User';
import Product from '../models/Product';
import { ProductCategory, UserRole } from '../types/index';

const defaultPassword = 'Password123!';

const users = [
  {
    firstName: 'FitFIXto',
    lastName: 'Admin',
    email: 'admin@fitfixto.com',
    phone: '9800000001',
    password: defaultPassword,
    role: UserRole.ADMIN,
    bio: 'Platform administrator for FitFIXto operations.',
  },
  {
    firstName: 'Aayush',
    lastName: 'Shrestha',
    email: 'customer@fitfixto.com',
    phone: '9800000002',
    password: defaultPassword,
    role: UserRole.CUSTOMER,
    bio: 'Fitness customer building a home gym setup.',
  },
  {
    firstName: 'Aria',
    lastName: 'Sharma',
    email: 'trainer@fitfixto.com',
    phone: '9800000003',
    password: defaultPassword,
    role: UserRole.TRAINER,
    bio: 'Certified strength and mobility trainer.',
  },
];

const products = [
  {
    name: 'Pro Hex Dumbbell Set 5-50lbs',
    description: 'Commercial-grade rubber hex dumbbell set for progressive strength training at home or in a gym.',
    price: 599,
    stock: 24,
    category: ProductCategory.GYM_EQUIPMENT,
    brand: 'IronCore',
    images: ['/dumbbell.png'],
    tags: ['dumbbells', 'strength', 'home gym'],
    sku: 'FFX-DUMB-001',
    discountPercentage: 25,
    weight: 250,
    isFeatured: true,
    isActive: true,
    verifiedBadge: true,
    averageRating: 4.8,
    ratingCount: 312,
  },
  {
    name: 'Olympic Power Rack PRO-X',
    description: 'Heavy-duty power rack with pull-up bar, safety arms and plate storage for serious lifting.',
    price: 1299,
    stock: 10,
    category: ProductCategory.GYM_EQUIPMENT,
    brand: 'TitanForge',
    images: ['/rack.png'],
    tags: ['rack', 'powerlifting', 'barbell'],
    sku: 'FFX-RACK-001',
    discountPercentage: 19,
    weight: 180,
    isFeatured: true,
    isActive: true,
    verifiedBadge: true,
    averageRating: 4.9,
    ratingCount: 187,
  },
  {
    name: 'Premium Whey Isolate 5lb',
    description: 'Fast-digesting whey isolate protein powder for muscle recovery and daily nutrition.',
    price: 79,
    stock: 80,
    category: ProductCategory.SUPPLEMENTS,
    brand: 'PureFuel',
    images: ['/whey.png'],
    tags: ['protein', 'whey', 'recovery'],
    sku: 'FFX-WHEY-001',
    discountPercentage: 20,
    weight: 2.3,
    isFeatured: true,
    isActive: true,
    verifiedBadge: true,
    averageRating: 4.7,
    ratingCount: 1204,
  },
  {
    name: 'Commercial Treadmill T-9000',
    description: 'Durable treadmill with incline controls, cushioned deck and built-in interval programs.',
    price: 2499,
    stock: 6,
    category: ProductCategory.GYM_EQUIPMENT,
    brand: 'RunForge',
    images: ['/treadmill.png'],
    tags: ['cardio', 'treadmill', 'commercial'],
    sku: 'FFX-TREAD-001',
    discountPercentage: 17,
    weight: 140,
    isFeatured: true,
    isActive: true,
    verifiedBadge: true,
    averageRating: 4.6,
    ratingCount: 89,
  },
  {
    name: 'Adjustable Weight Bench',
    description: 'Multi-position bench for flat, incline and seated pressing movements.',
    price: 249,
    stock: 18,
    category: ProductCategory.GYM_EQUIPMENT,
    brand: 'TitanForge',
    images: ['/bench.png'],
    tags: ['bench', 'strength', 'press'],
    sku: 'FFX-BENCH-001',
    discountPercentage: 10,
    isFeatured: false,
    isActive: true,
    verifiedBadge: true,
    averageRating: 4.6,
    ratingCount: 176,
  },
  {
    name: 'Training Grip Gloves',
    description: 'Breathable training gloves with padded palms and wrist support for lifting sessions.',
    price: 29,
    stock: 120,
    category: ProductCategory.ACCESSORIES,
    brand: 'GripMax',
    images: ['/gloves.png'],
    tags: ['gloves', 'grip', 'accessories'],
    sku: 'FFX-GLOVE-001',
    discountPercentage: 0,
    isFeatured: false,
    isActive: true,
    verifiedBadge: true,
    averageRating: 4.5,
    ratingCount: 88,
  },
  {
    name: 'Resistance Band Kit',
    description: 'Five-band resistance kit with handles, door anchor and carry pouch for mobility and strength.',
    price: 39,
    stock: 95,
    category: ProductCategory.ACCESSORIES,
    brand: 'FlexPro',
    images: ['/resistance-bands.png'],
    tags: ['bands', 'mobility', 'portable'],
    sku: 'FFX-BAND-001',
    discountPercentage: 5,
    isFeatured: false,
    isActive: true,
    verifiedBadge: true,
    averageRating: 4.4,
    ratingCount: 141,
  },
  {
    name: 'Creatine Monohydrate 500g',
    description: 'Micronized creatine monohydrate powder for strength, power and performance support.',
    price: 34,
    stock: 70,
    category: ProductCategory.SUPPLEMENTS,
    brand: 'PureFuel',
    images: ['/creatine.png'],
    tags: ['creatine', 'performance', 'supplement'],
    sku: 'FFX-CREATINE-001',
    discountPercentage: 0,
    isFeatured: false,
    isActive: true,
    verifiedBadge: true,
    averageRating: 4.8,
    ratingCount: 532,
  },
  {
    name: 'Competition Kettlebell 24kg',
    description: 'Steel competition kettlebell with consistent sizing and balanced handle for swings and presses.',
    price: 119,
    stock: 22,
    category: ProductCategory.GYM_EQUIPMENT,
    brand: 'IronCore',
    images: ['/kettlebell.png'],
    tags: ['kettlebell', 'conditioning', 'strength'],
    sku: 'FFX-KB-024',
    discountPercentage: 8,
    isFeatured: false,
    isActive: true,
    verifiedBadge: true,
    averageRating: 4.7,
    ratingCount: 96,
  },
  {
    name: 'Shaker Bottle 700ml',
    description: 'Leak-resistant shaker bottle with mixing ball and measurement markings for supplements.',
    price: 14,
    stock: 160,
    category: ProductCategory.ACCESSORIES,
    brand: 'HydraFit',
    images: ['/shaker.png'],
    tags: ['shaker', 'hydration', 'supplements'],
    sku: 'FFX-SHAKER-001',
    discountPercentage: 0,
    isFeatured: false,
    isActive: true,
    verifiedBadge: false,
    averageRating: 4.3,
    ratingCount: 64,
  },
];

const seedUsers = async () => {
  for (const userData of users) {
    const existingUser = await User.findOne({ email: userData.email }).select('+password');

    if (existingUser) {
      existingUser.firstName = userData.firstName;
      existingUser.lastName = userData.lastName;
      existingUser.phone = userData.phone;
      existingUser.password = userData.password;
      existingUser.role = userData.role;
      existingUser.bio = userData.bio;
      existingUser.isEmailVerified = true;
      existingUser.isActive = true;
      await existingUser.save();
      continue;
    }

    await User.create({
      ...userData,
      isEmailVerified: true,
      isActive: true,
    });
  }
};

const seedProducts = async () => {
  for (const productData of products) {
    await Product.findOneAndUpdate(
      { sku: productData.sku },
      { $set: productData },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }
};

const runSeed = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      autoIndex: env.NODE_ENV !== 'production',
      serverSelectionTimeoutMS: 10000,
    });

    await seedUsers();
    await seedProducts();

    console.log('FitFIXto seed complete.');
    console.log(`Seeded users: ${users.length}`);
    console.log(`Seeded products: ${products.length}`);
    console.log(`Default password for all seeded users: ${defaultPassword}`);
  } catch (error) {
    console.error('FitFIXto seed failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

runSeed();
