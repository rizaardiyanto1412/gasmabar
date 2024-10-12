'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useUser } from '@/lib/auth';
import { getRounds, updateRoundGames, clearCurrentRound, updateCurrentRound, createNewRound } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import AntrianComponent from '@/components/AntrianComponent';
import { v4 as uuidv4 } from 'uuid';
import { Toaster, toast } from 'react-hot-toast';

export type Game = {
  id?: string; // Make id optional
  gameId: string;
  isFastTrack: boolean;
};

type Round = {
  id: number;
  roundNumber: number;
  isCurrent: boolean;
  games: Game[];
};

// Custom hook for fetching rounds
const useFetchRounds = (user: any) => {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFastTrackEnabled, setIsFastTrackEnabled] = useState(false);
  const [gamesPerRound, setGamesPerRound] = useState(4);
  const fetchedRef = useRef(false);

  const fetchRounds = useCallback(async () => {
    if (!user || fetchedRef.current) return;
    setIsLoading(true);
    try {
      const fetchedRounds = await getRounds(user.id);
      const formattedRounds = fetchedRounds.map(round => ({
        ...round,
        games: round.games.map(game => ({
          ...game,
          id: game.id
        }))
      }));
      setRounds(formattedRounds.filter(round => !round.isCurrent));
      setCurrentRound(formattedRounds.find(round => round.isCurrent) || null);
      setIsFastTrackEnabled(user.fastTrackEnabled || false);
      setGamesPerRound(user.gamesPerRound || 4);
      fetchedRef.current = true;
    } catch (error) {
      console.error('Error fetching rounds:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && !fetchedRef.current) {
      fetchRounds();
    }
  }, [user, fetchRounds]);

  const refetch = useCallback(() => {
    fetchedRef.current = false;
    fetchRounds();
  }, [fetchRounds]);

  return { rounds, setRounds, currentRound, setCurrentRound, isLoading, isFastTrackEnabled, gamesPerRound, refetch };
};

export default function AntrianPage() {
  const { user } = useUser();
  const [gameIds, setGameIds] = useState('');
  const [gameNumber, setGameNumber] = useState(1);
  const [fastTrack, setFastTrack] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { 
    rounds, setRounds, currentRound, setCurrentRound, 
    isLoading, isFastTrackEnabled, gamesPerRound, refetch 
  } = useFetchRounds(user);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameIds.trim() || !user) return;

    const gameIdList = gameIds.split('\n').filter(id => id.trim() !== '');

    try {
      setIsSubmitting(true);

      // Optimistic update
      let updatedRounds = [...rounds];
      let updatedCurrentRound = currentRound ? { ...currentRound } : null;

      // **Sort allRounds by roundNumber ascendingly to prioritize earlier rounds**
      let allRounds: Round[] = updatedCurrentRound ? [updatedCurrentRound, ...updatedRounds] : [...updatedRounds];
      allRounds.sort((a, b) => a.roundNumber - b.roundNumber);

      console.log('Before processing:', { allRounds });

      // **Function to add games to rounds with Fast Track prioritization**
      // **Ensures each copy is added to a separate round**
      const addGamesToRounds = async (games: string[], isFastTrack: boolean) => {
        for (const gameId of games) {
          console.log(`Processing gameId: ${gameId}`);
          for (let i = 0; i < gameNumber; i++) {
            console.log(`  Iteration ${i + 1} of ${gameNumber}`);

            let targetRound: Round | null = null;

            if (isFastTrack) {
              // **Find the first round with available slots**
              targetRound = allRounds.find(
                round => round.games.length < gamesPerRound
              ) || null;

              if (!targetRound) {
                // **Create a new Fast Track round if no existing round has space**
                const newRoundNumber = allRounds.length + 1;
                targetRound = {
                  id: -updatedRounds.length - 1, // Negative ID for new rounds
                  roundNumber: newRoundNumber,
                  isCurrent: false,
                  games: []
                };
                updatedRounds.push(targetRound);
                allRounds.push(targetRound);
                console.log(`  Created new Fast Track Round ${targetRound.roundNumber}`);
              } else {
                console.log(`  Adding to existing Round ${targetRound.roundNumber}`);
              }
            } else {
              // **Regular Game Logic**
              // Find the first round that does not already have a copy of gameId and has space
              targetRound = allRounds.find(
                round => round.games.length < gamesPerRound && !round.games.some(g => g.gameId === gameId)
              ) || null;

              if (!targetRound) {
                // **Create a new round if no suitable existing round is found**
                const newRoundNumber = allRounds.length + 1;
                targetRound = {
                  id: -updatedRounds.length - 1, // Negative ID for new rounds
                  roundNumber: newRoundNumber,
                  isCurrent: false,
                  games: []
                };
                updatedRounds.push(targetRound);
                allRounds.push(targetRound);
                console.log(`  Created new Round ${targetRound.roundNumber}`);
              } else {
                console.log(`  Adding to existing Round ${targetRound.roundNumber}`);
              }
            }

            // **Add the game to the target round with Fast Track flag**
            targetRound.games.push({ id: uuidv4(), gameId: gameId.trim(), isFastTrack });
            console.log(`  Added game ${gameId} to Round ${targetRound.roundNumber}`);
          }
        }
      };

      // **Add Fast Track Games First**
      await addGamesToRounds(gameIdList, fastTrack);

      console.log('After processing all games:', { allRounds });

      // **Update state optimistically**
      setRounds(updatedRounds.filter(round => !round.isCurrent));
      setCurrentRound(allRounds.find(round => round.isCurrent) || null);

      // **Clear input fields**
      setGameIds('');
      setFastTrack(false);
      setGameNumber(1);

      // **Perform the actual API updates**
      const updatedRoundsFromServer = await Promise.all(
        updatedRounds.map(async (round) => {
          if (round.id < 0) {
            return await createNewRound(user.id, round.roundNumber, round.games);
          } else {
            return await updateRoundGames(user.id, round.id, round.games);
          }
        })
      );

      console.log('Server response:', updatedRoundsFromServer.map(r => ({ roundNumber: r.roundNumber, games: r.games.length })));

      // **Update state with server response only if different from optimistic update**
      const serverRounds = updatedRoundsFromServer.filter(round => !round.isCurrent);
      const serverCurrentRound = updatedRoundsFromServer.find(round => round.isCurrent) || null;

      if (JSON.stringify(serverRounds) !== JSON.stringify(updatedRounds)) {
        setRounds(serverRounds);
      }
      if (JSON.stringify(serverCurrentRound) !== JSON.stringify(updatedCurrentRound)) {
        setCurrentRound(serverCurrentRound);
      }

      // After server updates
      refetch(); // Use refetch instead of fetchRounds

      // Add this toast notification after successful submission
      toast.success('Games added successfully!');

    } catch (error) {
      console.error('Error updating rounds:', error);
      // Add this toast notification for errors
      toast.error('Failed to add games. Please try again.');
      refetch(); // Use refetch here as well
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearCurrentRound = async () => {
    if (!user || !currentRound) return;
    try {
      await clearCurrentRound(user.id);
      refetch(); // Use refetch here
      // Add this toast notification after clearing the current round
      toast.success('Current round cleared successfully!');
    } catch (error) {
      console.error('Error clearing current round:', error);
      // Add this toast notification for errors
      toast.error('Failed to clear current round. Please try again.');
    }
  };

  const moveToCurrentRound = async (roundId: number) => {
    if (!user) return;
    try {
      await updateCurrentRound(roundId);
      refetch(); // Use refetch here
      // Add this toast notification after moving a round to current
      toast.success('Round moved to current successfully!');
    } catch (error) {
      console.error('Error moving round to current:', error);
      // Add this toast notification for errors
      toast.error('Failed to move round to current. Please try again.');
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;

    const sourceRoundId = parseInt(source.droppableId);
    const destRoundId = parseInt(destination.droppableId);

    let updatedRounds = [...rounds];
    if (currentRound) {
      updatedRounds = [currentRound, ...updatedRounds];
    }

    const sourceRound = updatedRounds.find(round => round.id === sourceRoundId);
    const destRound = updatedRounds.find(round => round.id === destRoundId);

    if (!sourceRound || !destRound) return;

    const [reorderedItem] = sourceRound.games.splice(source.index, 1);
    destRound.games.splice(destination.index, 0, reorderedItem);

    setRounds(updatedRounds.filter(round => !round.isCurrent));
    if (currentRound) {
      setCurrentRound(updatedRounds.find(round => round.isCurrent) || null);
    }

    // Update the database
    if (user) {
      await updateRoundGames(user.id, sourceRound.id, sourceRound.games);
      if (sourceRoundId !== destRoundId) {
        await updateRoundGames(user.id, destRound.id, destRound.games);
      }
    }
  };

  const renderGameList = (round: Round) => (
    <Droppable droppableId={round.id.toString()}>
      {(provided) => (
        <div {...provided.droppableProps} ref={provided.innerRef}>
          {round.games
            .slice() // Create a shallow copy to avoid mutating state
            .sort((a, b) => {
              if (a.isFastTrack && !b.isFastTrack) return -1; // a comes before b
              if (!a.isFastTrack && b.isFastTrack) return 1;  // b comes before a
              return 0; // no change
            })
            .map((game, index) => (
              <Draggable key={game.id} draggableId={game.id || `temp-${index}`} index={index}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`mb-2 p-2 rounded ${game.isFastTrack ? 'bg-red-100' : 'bg-gray-100'}`}
                  >
                    {game.gameId} {game.isFastTrack && '(Fast Track)'}
                  </div>
                )}
              </Draggable>
            ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );

  if (!user) {
    return <div>Please sign in to view your game rounds.</div>;
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <Toaster position="top-right" />
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Antrian
      </h1>

      <form onSubmit={handleSubmit} className="mb-8">
        <Label htmlFor="gameIds">Game IDs (one per line)</Label>
        <div className="flex items-end gap-4 mb-2 w-full">
          <div className="flex w-full gap-2">
            <textarea
              id="gameIds"
              value={gameIds}
              onChange={(e) => setGameIds(e.target.value)}
              placeholder="Enter Game IDs (one per line)"
              className="w-full h-10 p-2 border rounded"
            />
            <Input
              id="gameNumber"
              type="number"
              min="1"
              max="10"
              value={gameNumber}
              onChange={(e) => setGameNumber(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              className="w-20"
            />
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
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

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Current Round</CardTitle>
            </CardHeader>
            <CardContent>
              {currentRound && currentRound.games && currentRound.games.length > 0 ? (
                renderGameList(currentRound)
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
                      renderGameList(round)
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
      </DragDropContext>
    </section>
  );
}

// Add this new function to consolidate rounds
const consolidateRounds = (rounds: Round[], gamesPerRound: number): Round[] => {
  if (rounds.length === 0) return [];

  let consolidatedRounds: Round[] = [];
  let allGames: Game[] = rounds.flatMap(round => round.games);

  // Separate fast track and regular games
  const fastTrackGames = allGames.filter(game => game.isFastTrack);
  const regularGames = allGames.filter(game => !game.isFastTrack);

  let currentRound: Round | null = null;

  // Distribute fast track games
  fastTrackGames.forEach(game => {
    if (!currentRound || currentRound.games.length >= gamesPerRound) {
      currentRound = {
        id: consolidatedRounds.length > 0 ? -consolidatedRounds.length - 1 : rounds[0].id,
        roundNumber: consolidatedRounds.length + 1,
        isCurrent: false,
        games: []
      };
      consolidatedRounds.push(currentRound);
    }
    currentRound.games.push(game);
  });

  // Distribute regular games
  regularGames.forEach(game => {
    if (!currentRound || currentRound.games.length >= gamesPerRound) {
      currentRound = {
        id: consolidatedRounds.length > 0 ? -consolidatedRounds.length - 1 : rounds[0].id,
        roundNumber: consolidatedRounds.length + 1,
        isCurrent: false,
        games: []
      };
      consolidatedRounds.push(currentRound);
    }
    currentRound.games.push(game);
  });

  // Preserve existing round IDs where possible
  return consolidatedRounds.map((round, index) => {
    const existingRound = rounds.find(r => r.roundNumber === index + 1);
    return {
      ...round,
      id: existingRound ? existingRound.id : round.id,
      roundNumber: index + 1
    };
  });
};