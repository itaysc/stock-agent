import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Deployment, DeploymentStatus } from './deployment.types.js';

/** A paper deployment, saved after every cycle (ledgers, snapshots, events). */
@Schema({ collection: 'deployments', timestamps: true })
export class DeploymentRun {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, index: true })
  status: DeploymentStatus;

  /** Every symbol of every sleeve: a symbol belongs to one live deployment only. */
  @Prop({ type: [String], required: true, index: true })
  symbols: string[];

  @Prop({ type: Number, required: true })
  capital: number;

  @Prop({ type: Object, required: true })
  deployment: Deployment;

  createdAt: Date;
  updatedAt: Date;
}

export const DeploymentRunSchema = SchemaFactory.createForClass(DeploymentRun);
