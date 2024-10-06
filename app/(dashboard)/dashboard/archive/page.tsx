'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/auth';
import { getArchivedRounds, deleteArchivedRound, deleteAllArchivedRounds } from './actions';

type Game = {
  id: string;  // Changed from number to string
  createdAt: Date;
  roundId: number;
  gameId: string;
  isFastTrack: boolean;
};

type Round = {
  id: number;
  createdAt: Date;
  userId: number;
  roundNumber: number;
  isCurrent: boolean;
  isArchived: boolean;
  archivedAt: Date | null;
  games: Game[];
};

export default function ArchivePage() {
  const { user } = useUser();
  const [archivedRounds, setArchivedRounds] = useState<Round[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchArchivedRounds = useCallback(async () => {
    if (!user || hasFetched) return;
    setIsLoading(true);
    try {
      const fetchedArchivedRounds = await getArchivedRounds(user.id);
      setArchivedRounds(fetchedArchivedRounds as Round[]);  // Type assertion
      setHasFetched(true);
    } catch (error) {
      console.error('Error fetching archived rounds:', error);
      setMessage({ text: 'Failed to fetch archived rounds', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [user, hasFetched]);

  useEffect(() => {
    fetchArchivedRounds();
  }, [fetchArchivedRounds]);

  const handleDelete = async (roundId: number) => {
    if (!user) return;
    try {
      await deleteArchivedRound(user.id, roundId);
      setArchivedRounds(prevRounds => prevRounds.filter(round => round.id !== roundId));
      setMessage({ text: 'Round deleted successfully', type: 'success' });
    } catch (error) {
      console.error('Error deleting archived round:', error);
      setMessage({ text: 'Failed to delete round', type: 'error' });
    }
  };

  const handleDeleteAll = async () => {
    if (!user) return;
    try {
      const result = await deleteAllArchivedRounds(user.id);
      if (result.success) {
        setArchivedRounds([]);
        setMessage({ text: result.message, type: 'success' });
      } else {
        setMessage({ text: result.message, type: 'error' });
      }
    } catch (error) {
      console.error('Error deleting all archived rounds:', error);
      setMessage({ text: 'An unexpected error occurred while deleting archived rounds', type: 'error' });
    }
  };

  if (!user) {
    return <div>Please sign in to view your archived rounds.</div>;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-lg lg:text-2xl font-medium text-gray-900">
          Archived Rounds
        </h1>
        <Button 
          variant="destructive" 
          onClick={handleDeleteAll}
          disabled={archivedRounds.length === 0}
        >
          Delete All Archives
        </Button>
      </div>

      {message && (
        <div className={`p-4 mb-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {archivedRounds.map((round) => (
          <Card key={round.id}>
            <CardHeader>
              <CardTitle>Round {round.roundNumber}</CardTitle>
              <p className="text-sm text-gray-500">
                Archived at: {round.archivedAt ? new Date(round.archivedAt).toLocaleString() : 'N/A'}
              </p>
            </CardHeader>
            <CardContent>
              {round.games && round.games.length > 0 ? (
                round.games.map((game, gameIndex) => (
                  <div key={gameIndex}>
                    {game.gameId} {game.isFastTrack && "(Fast Track)"}
                  </div>
                ))
              ) : (
                <p>No games in this round</p>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                variant="destructive" 
                onClick={() => handleDelete(round.id)}
              >
                Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}