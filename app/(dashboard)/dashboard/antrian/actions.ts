'use server';

import { db } from '@/lib/db/drizzle';
import { rounds, games } from '@/lib/db/schema';
import { eq, and, notInArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export type Game = {
  id: string;
  gameId: string;
  isFastTrack: boolean;
};

export type Round = {
  id: number;
  roundNumber: number;
  isCurrent: boolean;
  games: Game[];
};

export async function getRounds(userId: number) {
  const allRounds = await db.select().from(rounds)
    .where(and(
      eq(rounds.userId, userId),
      eq(rounds.isArchived, false)
    ))
    .orderBy(rounds.roundNumber);
  const roundsWithGames = await Promise.all(
    allRounds.map(async (round) => {
      const roundGames = await db
        .select()
        .from(games)
        .where(eq(games.roundId, round.id))
        .orderBy(games.createdAt);
      return { ...round, games: roundGames || [] };
    })
  );
  return roundsWithGames;
}

export async function addGameToRound(userId: number, roundId: number, gameId: string, isFastTrack: boolean) {
  // Verify that the round belongs to the user before adding the game
  const round = await db.select().from(rounds)
    .where(and(eq(rounds.id, roundId), eq(rounds.userId, userId)))
    .limit(1);
  
  if (round.length === 0) {
    throw new Error("Round not found or doesn't belong to the user");
  }

  await db.insert(games).values({
    id: uuidv4(), // This is now correct as id is a string
    roundId,
    gameId,
    isFastTrack,
  });
}

// Update the createNewRound function to accept initial games
export async function createNewRound(userId: number, roundNumber: number, initialGames: Omit<Game, 'id'>[] = []): Promise<Round> {
  const [newRound] = await db.insert(rounds).values({
    userId,
    roundNumber,
    isCurrent: false,
  }).returning();

  if (initialGames.length > 0) {
    await db.insert(games).values(
      initialGames.map(game => ({
        id: uuidv4(),
        roundId: newRound.id,
        gameId: game.gameId,
        isFastTrack: game.isFastTrack,
      }))
    );
  }

  const roundGames = initialGames.map(game => ({
    id: uuidv4(),
    gameId: game.gameId,
    isFastTrack: game.isFastTrack
  }));

  return { ...newRound, games: roundGames };
}

async function getRound(roundId: number): Promise<Round> {
  const [round] = await db.select().from(rounds).where(eq(rounds.id, roundId));
  const roundGames = await db.select().from(games).where(eq(games.roundId, roundId));
  return { ...round, games: roundGames.map(game => ({
    id: game.id,
    gameId: game.gameId,
    isFastTrack: game.isFastTrack
  })) };
}

export async function updateCurrentRound(roundId: number) {
  const round = await db.select().from(rounds).where(eq(rounds.id, roundId)).limit(1);
  
  if (round.length === 0) {
    throw new Error("Round not found");
  }

  const userId = round[0].userId;

  await db.update(rounds)
    .set({ isCurrent: false })
    .where(eq(rounds.userId, userId));
  await db.update(rounds)
    .set({ isCurrent: true })
    .where(eq(rounds.id, roundId));
}

export async function clearCurrentRound(userId: number) {
  const currentRound = await db.select().from(rounds)
    .where(and(eq(rounds.userId, userId), eq(rounds.isCurrent, true)))
    .limit(1);

  if (currentRound.length === 0) {
    throw new Error("No current round found");
  }

  const roundId = currentRound[0].id;

  // Delete associated games first
  await db.delete(games).where(eq(games.roundId, roundId));

  // Then delete the round itself
  await db.delete(rounds).where(eq(rounds.id, roundId));
}

export async function getArchivedRounds(userId: number) {
  const archivedRounds = await db.select().from(rounds)
    .where(and(eq(rounds.userId, userId), eq(rounds.isArchived, true)))
    .orderBy(rounds.archivedAt);

  const roundsWithGames = await Promise.all(
    archivedRounds.map(async (round) => {
      const roundGames = await db
        .select()
        .from(games)
        .where(eq(games.roundId, round.id))
        .orderBy(games.createdAt);
      return { ...round, games: roundGames || [] };
    })
  );
  return roundsWithGames;
}

export async function deleteArchivedRound(userId: number, roundId: number) {
  const round = await db.select().from(rounds)
    .where(and(
      eq(rounds.id, roundId),
      eq(rounds.userId, userId),
      eq(rounds.isArchived, true)
    ))
    .limit(1);

  if (round.length === 0) {
    throw new Error("Archived round not found or doesn't belong to the user");
  }

  // Delete associated games first
  await db.delete(games).where(eq(games.roundId, roundId));

  // Then delete the round itself
  await db.delete(rounds).where(eq(rounds.id, roundId));
}

// Update the updateRoundGames function to handle potential new games
export async function updateRoundGames(userId: number, roundId: number, updatedGames: Omit<Game, 'id'>[]): Promise<Round> {
  // First, check if the round exists and belongs to the user
  const existingRound = await db.select().from(rounds)
    .where(and(eq(rounds.id, roundId), eq(rounds.userId, userId)))
    .limit(1);

  if (existingRound.length === 0) {
    throw new Error("Round not found or doesn't belong to the user");
  }

  // Delete all existing games for this round
  await db.delete(games).where(eq(games.roundId, roundId));

  // Insert all games as new entries
  if (updatedGames.length > 0) {
    await db.insert(games).values(
      updatedGames.map(game => ({
        id: uuidv4(),
        roundId,
        gameId: game.gameId,
        isFastTrack: game.isFastTrack,
      }))
    );
  }

  return getRound(roundId);
}
