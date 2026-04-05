
console.log('=== Starting X-Thread Backend ===\n');

try {
  const { NestFactory } = require('@nestjs/core');
  const { FastifyAdapter, NestFastifyApplication } = require('@nestjs/platform-fastify');
  const { AppModule } = require('./dist/app.module');
  const port = Number(process.env.PORT || 3001);

  console.log('✓ All modules imported successfully');
  console.log('  - NestFactory:', typeof NestFactory);
  console.log('  - FastifyAdapter:', typeof FastifyAdapter);
  console.log('  - AppModule:', typeof AppModule);

  async function bootstrap() {
    console.log('\nCreating Nest application...');
    const app = await NestFactory.create(AppModule, new FastifyAdapter());
    
    console.log('Enabling CORS...');
    app.enableCors({ origin: '*' });
    
    console.log('Setting global prefix...');
    app.setGlobalPrefix('api');
    
    console.log(`\nStarting server on http://localhost:${port}...`);
    try {
      await app.listen(port, '0.0.0.0');
    } catch (err) {
      if (err?.code === 'EADDRINUSE') {
        console.error(`\nPort ${port} is already in use. Stop the existing process on that port or change PORT before restarting the backend.`);
      }
      throw err;
    }
    
    const url = await app.getUrl();
    console.log('\n=====================================');
    console.log('✓ X-Thread backend running on', url);
    console.log(`  Visit: http://localhost:${port}`);
    console.log('=====================================\n');
  }

  bootstrap().catch(err => {
    console.error('\n✗ Bootstrap error:', err);
    process.exit(1);
  });

} catch (e) {
  console.error('\n✗ Initialization error:', e);
  console.error('Stack:', e.stack);
  process.exit(1);
}
