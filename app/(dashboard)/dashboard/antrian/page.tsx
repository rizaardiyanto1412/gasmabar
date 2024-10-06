'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useUser } from '@/lib/auth';
import { addGameToRound, getRounds, createNewRound, updateCurrentRound, clearCurrentRound, updateRoundGames } from '@/app/(dashboard)/dashboard/antrian/actions';

// Define and export the Game type
export type Game = {
  id: number;
  gameId: string;
  isFastTrack: boolean;
};

type Round = {
  id: number;
  roundNumber: number;
  isCurrent: boolean;
  games: Game[];
};

export default function AntrianPage() {
  const { user } = useUser();
  const [gameId, setGameId] = useState('');
  const [fastTrack, setFastTrack] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFastTrackEnabled, setIsFastTrackEnabled] = useState(false);
  const [gamesPerRound, setGamesPerRound] = useState(4);

  const fetchRounds = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const fetchedRounds = await getRounds(user.id);
      console.log('Fetched rounds:', fetchedRounds);
      setRounds(fetchedRounds.filter(round => !round.isCurrent));
      setCurrentRound(fetchedRounds.find(round => round.isCurrent) || null);
      setIsFastTrackEnabled(user.fastTrackEnabled || false);
      setGamesPerRound(user.gamesPerRound || 4);
    } catch (error) {
      console.error('Error fetching rounds:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && isLoading) {
      fetchRounds();
    }
  }, [user, isLoading, fetchRounds]);

  const handleSubmit = async (e: React.FormEvent) => {
    setIsLoading(true);
    e.preventDefault();
    if (!gameId.trim() || !user) return;

    try {
      let updatedRounds = [...rounds];
      const newGame: Game = { id: Date.now(), gameId, isFastTrack: fastTrack };

      if (fastTrack) {
        // For Fast Track items
        let targetRound = updatedRounds[0];
        if (!targetRound) {
          // Create a new round if there are no rounds
          const newRound = await createNewRound(user.id, 1);
          targetRound = { ...newRound, games: [] };
          updatedRounds.push(targetRound);
        }

        // Find the position to insert the new Fast Track game
        const lastFastTrackIndex = targetRound.games.findLastIndex(game => game.isFastTrack);
        const insertIndex = lastFastTrackIndex === -1 ? 0 : lastFastTrackIndex + 1;
        
        // Insert the new Fast Track game
        targetRound.games.splice(insertIndex, 0, newGame);

        // Redistribute games if necessary
        while (targetRound.games.length > gamesPerRound) {
          const lastGame = targetRound.games.pop()!;
          if (!lastGame.isFastTrack) {
            let nextRound = updatedRounds[updatedRounds.indexOf(targetRound) + 1];
            if (!nextRound) {
              // Create a new round for the moved game
              const newRound = await createNewRound(user.id, updatedRounds.length + 1);
              nextRound = { ...newRound, games: [] };
              updatedRounds.push(nextRound);
            }
            nextRound.games.unshift(lastGame);
          } else {
            // If the last game is also Fast Track, put it back and stop redistribution
            targetRound.games.push(lastGame);
            break;
          }
        }
      } else {
        // For non-Fast Track items, add to the last round or create a new one if full
        let targetRound = updatedRounds[updatedRounds.length - 1];
        if (!targetRound || targetRound.games.length >= gamesPerRound) {
          const newRound = await createNewRound(user.id, updatedRounds.length + 1);
          targetRound = { ...newRound, games: [] };
          updatedRounds.push(targetRound);
        }
        targetRound.games.push(newGame);
      }

      // Update the rounds in the database
      for (const round of updatedRounds) {
        await updateRoundGames(user.id, round.id, round.games);
      }

      console.log('Updated rounds:', updatedRounds);
      setRounds(updatedRounds);
      setGameId('');
      setFastTrack(false);
      await fetchRounds(); // Fetch the updated rounds from the server
    } catch (error) {
      console.error('Error submitting game:', error);
    }
  };

  const moveToCurrentRound = async (roundId: number) => {
    if (!user) return;
    await updateCurrentRound(roundId);
    setIsLoading(true);
  };

  const handleClearCurrentRound = async () => {
    if (!user || !currentRound) return;
    await clearCurrentRound(user.id);
    setIsLoading(true);
  };

  if (!user) {
    return <div>Please sign in to view your game rounds.</div>;
  }

//   if (isLoading) {
//     return <div>Loading...</div>;
//   }

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

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Antrian
      </h1>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <Label htmlFor="gameId">Game ID</Label>
            <Input
              id="gameId"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="Enter Game ID"
            />
          </div>
          
          <Button type="submit">{isLoading ? 'Submitting...' : 'Submit'}</Button>
        </div>
        {isFastTrackEnabled && (
            <div className="flex items-center gap-2 mt-2">
              <Checkbox
                id="fastTrack"
                checked={fastTrack}
                onCheckedChange={(checked) => setFastTrack(checked as boolean)}
              />
              <Label htmlFor="fastTrack">Fast Track</Label>
            </div>
          )}
      </form>

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
          <CardFooter>
            <Button onClick={handleClearCurrentRound} variant="destructive">
              Clear Current Round
            </Button>
          </CardFooter>
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
              <CardFooter>
                <Button onClick={() => moveToCurrentRound(round.id)}>
                  Move to Current Round
                </Button>
              </CardFooter>
            </Card>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}