import { Module } from '@nestjs/common';
import { AuthzModule } from '@ecoswift/authz';
import { AuditQueryService } from './services/audit-query.service';
import { AuditController } from './controllers/audit.controller';

@Module({
  imports: [AuthzModule],
  controllers: [AuditController],
  providers: [AuditQueryService],
})
export class AuditModule {}
