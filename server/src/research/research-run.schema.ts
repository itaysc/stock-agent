import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { ResearchSession, ResearchStatus } from './research.types.js';

/** One research-agent session, saved after every step so progress can be followed. */
@Schema({ collection: 'research_sessions', timestamps: true })
export class ResearchRun {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, index: true })
  status: ResearchStatus;

  @Prop({ type: [String], required: true, index: true })
  symbols: string[];

  @Prop({ type: Object, required: true })
  session: ResearchSession;

  createdAt: Date;
  updatedAt: Date;
}

export const ResearchRunSchema = SchemaFactory.createForClass(ResearchRun);
