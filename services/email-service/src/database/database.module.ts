import { Module } from '@nestjs/common';
import { PrismaModule } from '@ecoswift/database';

/**
 * Thin re-export so app code depends on a local, app-owned module path
 * rather than reaching into the shared package directly from every feature
 * module.
 */
@Module({
  imports: [PrismaModule],
  exports: [PrismaModule],
})
export class DatabaseModule {}
