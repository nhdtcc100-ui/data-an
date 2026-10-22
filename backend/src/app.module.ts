import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DuckDbService } from './modules/query-engine/duckdb.service';
import { DataIngestionService } from './modules/data-ingestion/data-ingestion.service';
import { ShareService } from './modules/share/share.service';
import { MultiTenantWorkspaceGuard } from './modules/auth/jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'super_secret_enterprise_jwt_key_2026_modern_bi_platform_key!',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [
    DuckDbService,
    DataIngestionService,
    ShareService,
    MultiTenantWorkspaceGuard,
  ],
  exports: [
    DuckDbService,
    DataIngestionService,
    ShareService,
  ],
})
export class AppModule {}
