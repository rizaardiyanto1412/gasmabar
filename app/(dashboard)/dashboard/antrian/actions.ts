'use server';

import { db } from '@/lib/db/drizzle';
import { rounds, roundGames } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export async function getRounds(userId: number) {
  const allRounds = await db.select().from(rounds)
    .where(and(
      eq(rounds.userId, userId),
      eq(rounds.isArchived, false)  // Add this condition
    ))
    .orderBy(rounds.roundNumber);
  const roundsWithGames = await Promise.all(
    allRounds.map(async (round) => {
      const games = await db
        .select()
        .from(roundGames)
        .where(eq(roundGames.roundId, round.id))
        .orderBy(roundGames.createdAt);
      return { ...round, games: games || [] };
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

  await db.insert(roundGames).values({
    roundId,
    gameId,
    isFastTrack,
  });
}

export async function createNewRound(userId: number, roundNumber: number) {
  const [newRound] = await db
    .insert(rounds)
    .values({ userId, roundNumber })
    .returning();
  return newRound;
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

  await db.update(rounds)
    .set({ isCurrent: false, isArchived: true, archivedAt: new Date() })
    .where(eq(rounds.id, currentRound[0].id));
}

export async function getArchivedRounds(userId: number) {
  const archivedRounds = await db.select().from(rounds)
    .where(and(eq(rounds.userId, userId), eq(rounds.isArchived, true)))
    .orderBy(rounds.archivedAt);

  const roundsWithGames = await Promise.all(
    archivedRounds.map(async (round) => {
      const games = await db
        .select()
        .from(roundGames)
        .where(eq(roundGames.roundId, round.id))
        .orderBy(roundGames.createdAt);
      return { ...round, games: games || [] };
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
  await db.delete(roundGames).where(eq(roundGames.roundId, roundId));

  // Then delete the round itself
  await db.delete(rounds).where(eq(rounds.id, roundId));
}

export async function updateRoundGames(userId: number, roundId: number, games: Game[]) {
  try {
    // First, delete all existing games for this round
    await db.delete(roundGames).where(eq(roundGames.roundId, roundId));

    // Then, insert the new games
    for (const game of games) {
      await db.insert(roundGames).values({
        roundId,
        gameId: game.gameId,
        isFastTrack: game.isFastTrack,
      });
    }

    console.log(`Updated games for round ${roundId}`);
  } catch (error) {
    console.error('Error updating round games:', error);
    throw error;
  }
}