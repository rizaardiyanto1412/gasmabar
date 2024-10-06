'use server';

import { db } from '@/lib/db/drizzle';
import { rounds, games } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

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

export async function deleteAllArchivedRounds(userId: number) {
  try {
    const archivedRoundIds = await db.select({ id: rounds.id })
      .from(rounds)
      .where(and(eq(rounds.userId, userId), eq(rounds.isArchived, true)));

    if (archivedRoundIds.length === 0) {
      return {
        success: true,
        message: "No archived rounds to delete",
        deletedIds: []
      };
    }

    await db.delete(games)
      .where(sql`${games.roundId} IN ${archivedRoundIds.map(r => r.id)}`);

    const result = await db.delete(rounds)
      .where(and(eq(rounds.userId, userId), eq(rounds.isArchived, true)))
      .returning({ deletedId: rounds.id });

    return { 
      success: true, 
      message: `Successfully deleted ${result.length} archived rounds`,
      deletedIds: result.map(r => r.deletedId)
    };
  } catch (error) {
    if (error instanceof Error) {
      return { 
        success: false, 
        message: `Failed to delete all archived rounds: ${error.message}`,
        error: error.stack
      };
    } else {
      return { 
        success: false, 
        message: "Failed to delete all archived rounds due to an unknown error",
        error: String(error)
      };
    }
  }
}