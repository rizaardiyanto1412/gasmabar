'use client';

import { useEffect, useState } from 'react';
import { getRounds } from '@/app/(dashboard)/dashboard/antrian/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Define the types directly in this file
type Game = {
  gameId: string;
  isFastTrack: boolean;
  // Add other properties as needed
};

type Round = {
  id: number;
  createdAt: Date;
  userId: number;
  roundNumber: number;
  isCurrent: boolean;
  games: Game[];
};

type AntrianComponentProps = {
  userId: number;
};

export default function AntrianComponent({ userId }: AntrianComponentProps) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRounds() {
      setIsLoading(true);
      try {
        const fetchedRounds = await getRounds(userId);
        setRounds(fetchedRounds.filter(round => !round.isCurrent));
        setCurrentRound(fetchedRounds.find(round => round.isCurrent) || null);
      } catch (error) {
        console.error('Error fetching rounds:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRounds();
  }, [userId]);

  const renderGameList = (games: Game[]) => {
    const fastTrackGames = games.filter(game => game.isFastTrack);
    const regularGames = games.filter(game => !game.isFastTrack);

    return (
      <div>
        {fastTrackGames.map((game, index) => (
          <div key={index} className="text-red-600 font-bold">
            {game.gameId} (Fast Track)
          </div>
        ))}
        {regularGames.map((game, index) => (
          <div key={index}>{game.gameId}</div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Round</CardTitle>
        </CardHeader>
        <CardContent>
          {currentRound && currentRound.games && currentRound.games.length > 0 ? (
            renderGameList(currentRound.games)
          ) : (
            <p>No games in the current round</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Round List</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rounds.map((round) => (
            <Card key={round.id}>
              <CardHeader>
                <CardTitle>Round {round.roundNumber}</CardTitle>
              </CardHeader>
              <CardContent>
                {round.games && round.games.length > 0 ? (
                  renderGameList(round.games)
                ) : (
                  <p>No games in this round</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}