// Test setup file
// Configure test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

beforeAll(() => {
  console.log('Starting tests...');
});

afterAll(() => {
  console.log('Tests completed');
});
