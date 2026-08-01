# FitFIXto Backend

A Node.js/Express TypeScript backend for the FitFIXto fitness marketplace platform.

## Features

- User authentication and authorization (JWT)
- Role-based access control
- Product management (gym equipment, supplements, accessories)
- Shopping cart and checkout system
- Order management
- Review and rating system
- Trainer booking
- Email notifications
- File uploads with Multer
- Input validation with Zod
- Centralized error handling
- Jest and Supertest for testing

## Getting Started

### Prerequisites

- Node.js (v16+)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create .env file from .env.example:
```bash
cp .env.example .env
```

3. Configure environment variables in .env

### Running the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

### Testing

Run tests:
```bash
npm test
```

Watch mode:
```bash
npm run test:watch
```

## Project Structure

```
src/
├── config/          # Configuration files (database, env)
├── models/          # Mongoose schemas
├── controllers/     # Request handlers
├── routes/          # API routes
├── middlewares/     # Express middlewares
├── services/        # Business logic
├── utils/           # Utility functions
├── validations/     # Zod schemas
├── types/           # TypeScript types
└── __tests__/       # Test files
```

## Core API Modules

- Authentication
- Products
- Cart
- Orders
- Reviews
- Trainers
- Admin

## Technologies

- Express.js
- TypeScript
- MongoDB & Mongoose
- JWT
- Zod
- Multer
- Nodemailer
- Jest & Supertest

