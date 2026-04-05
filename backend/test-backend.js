
const { NestFactory } = require('@nestjs/core');
const { FastifyAdapter, NestFastifyApplication } = require('@nestjs/platform-fastify');

console.log('Testing backend modules...');

try {
  console.log('1. Checking NestJS core...');
  console.log('   NestFactory:', typeof NestFactory);
  
  console.log('\n2. Checking Fastify adapter...');
  console.log('   FastifyAdapter:', typeof FastifyAdapter);
  
  console.log('\n3. Testing require app.module...');
  try {
    const appModule = require('./dist/app.module');
    console.log('   ✓ AppModule loaded');
  } catch (e) {
    console.log('   ✗ Error loading app.module:', e.message);
  }
  
  console.log('\nAll checks completed!');
} catch (e) {
  console.error('Error:', e);
}

