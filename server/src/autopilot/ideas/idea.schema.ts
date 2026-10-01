import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Idea } from './idea.types.js';

/** An investment idea waiting for your answer (or answered). */
@Schema({ collection: 'autopilot_ideas', timestamps: true })
export class IdeaDoc {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, index: true })
  status: Idea['status'];

  @Prop({ type: Object, required: true })
  idea: Idea;

  createdAt: Date;
}

export const IdeaSchema = SchemaFactory.createForClass(IdeaDoc);
