import { Module } from '@nestjs/common';
import { AuthzModule } from '@ecoswift/authz';
import { AccountStatementsController, StatementsQueryController } from './controllers/statements.controller';
import { StatementsService } from './services/statements.service';
import { StatementRendererService } from './services/statement-renderer.service';
import { StatementWorker } from './workers/statement.worker';

@Module({
  imports: [AuthzModule],
  controllers: [AccountStatementsController, StatementsQueryController],
  providers: [StatementsService, StatementRendererService, StatementWorker],
})
export class StatementsModule {}
