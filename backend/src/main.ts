import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as express from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS for Modern Web Frontends
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Support large datasets and payloads up to 60MB
  app.use(express.json({ limit: '60mb' }));
  app.use(express.urlencoded({ limit: '60mb', extended: true }));

  // Global API Prefix
  app.setGlobalPrefix('api/v1');

  // Simple Liveness / Readiness Health Endpoint
  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.get('/api/health', (_req: express.Request, res: express.Response) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'enterprise-bi-backend',
      duckdb: 'ready',
    });
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 Modern BI Analytics Backend running on: http://localhost:${port}/api/v1`);
}

bootstrap();
