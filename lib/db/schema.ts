import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
  fastTrackEnabled: boolean('fast_track_enabled').notNull().default(false), // Add this line
  gamesPerRound: integer('games_per_round').notNull().default(4), // Add this line
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});


export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const games = pgTable('games', {
  id: text('id').primaryKey(),  // Changed from serial() to text()
  roundId: integer('round_id').notNull().references(() => rounds.id),
  gameId: text('game_id').notNull(),
  isFastTrack: boolean('is_fast_track').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const rounds = pgTable('rounds', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  roundNumber: integer('round_number').notNull(),
  isCurrent: boolean('is_current').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const roundGames = pgTable('round_games', {
  id: text('id').primaryKey(),
  roundId: integer('round_id').notNull().references(() => rounds.id),
  gameId: text('game_id').notNull(),
  isFastTrack: boolean('is_fast_track').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export type User = typeof users.$inferSelect & {
  gamesPerRound: number;
};
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;

export type Round = typeof rounds.$inferSelect;
export type NewRound = typeof rounds.$inferInsert;
export type RoundGame = typeof roundGames.$inferSelect;
export type NewRoundGame = typeof roundGames.$inferInsert;
