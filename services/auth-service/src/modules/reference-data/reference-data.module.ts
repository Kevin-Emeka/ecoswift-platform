import { Module } from '@nestjs/common';
import { ReferenceDataController } from './controllers/reference-data.controller';

@Module({
  controllers: [ReferenceDataController],
})
export class ReferenceDataModule {}
