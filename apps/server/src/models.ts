import mongoose from 'mongoose';
import type { Profile } from '@uno/shared';

const { Schema, model, models } = mongoose;

export interface ProfileRecord extends Omit<Profile, 'id'> {
  profileId: string;
}

const ProfileSchema = new Schema(
  {
    profileId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    avatar: { type: String, required: true },
    settings: { type: Schema.Types.Mixed, required: true },
    statistics: { type: Schema.Types.Mixed, required: true },
    matchHistory: { type: [Schema.Types.Mixed], default: [] }
  },
  {
    timestamps: true
  }
);

export const ProfileModel = models.Profile ?? model<ProfileRecord>('Profile', ProfileSchema);
