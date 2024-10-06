'use client';

import { useEffect, useState } from 'react';
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

export default function AntrianPage() {
  const { user } = useUser();
  const [gameId, setGameId] = useState('');
  const [fastTrack, setFastTrack] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFastTrackEnabled, setIsFastTrackEnabled] = useState(false);
  const [gamesPerRound, setGamesPerRound] = useState(4);

  const fetchRounds = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const fetchedRounds = await getRounds(user.id);
      const formattedRounds = fetchedRounds.map(round => ({
        ...round,
        games: round.games.map(game => ({
          ...game,
          id: game.id // No need to convert to number anymore
        }))
      }));
      setRounds(formattedRounds.filter(round => !round.isCurrent));
      setCurrentRound(formattedRounds.find(round => round.isCurrent) || null);
      setIsFastTrackEnabled(user.fastTrackEnabled || false);
      setGamesPerRound(user.gamesPerRound || 4);
    } catch (error) {
      console.error('Error fetching rounds:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && isLoading) {
      fetchRounds();
    }
  }, [user, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameId.trim() || !user) return;

    const newGame: Game = { id: uuidv4(), gameId, isFastTrack: fastTrack };

    try {
      setIsLoading(true);

      // Optimistic update
      let updatedRounds = [...rounds];
      let updatedCurrentRound = currentRound ? { ...currentRound } : null;

      if (fastTrack) {
        // Fast Track logic
        let targetRound = updatedRounds.find(round => round.games.length < gamesPerRound) || updatedCurrentRound;
        if (!targetRound) {
          targetRound = { id: -1, roundNumber: updatedRounds.length + 1, isCurrent: false, games: [] };
          updatedRounds.push(targetRound);
        }
        const lastFastTrackIndex = targetRound.games.findLastIndex(game => game.isFastTrack);
        if (lastFastTrackIndex === -1) {
          targetRound.games.unshift(newGame);
        } else {
          targetRound.games.splice(lastFastTrackIndex + 1, 0, newGame);
        }
      } else {
        // Non-Fast Track logic
        let targetRound = updatedRounds[updatedRounds.length - 1] || updatedCurrentRound;
        if (!targetRound || targetRound.games.length >= gamesPerRound) {
          targetRound = { id: -1, roundNumber: updatedRounds.length + 1, isCurrent: false, games: [] };
          updatedRounds.push(targetRound);
        }
        targetRound.games.push(newGame);
      }

      // Consolidate rounds
      updatedRounds = consolidateRounds(updatedRounds, gamesPerRound);

      // Update state optimistically
      setRounds(updatedRounds.filter(round => !round.isCurrent));
      setCurrentRound(updatedCurrentRound || updatedRounds.find(round => round.isCurrent) || null);

      // Clear input fields
      setGameId('');
      setFastTrack(false);

      // Perform the actual API updates
      const updatedRoundsFromServer = await Promise.all(
        updatedRounds.map(async (round) => {
          if (round.id < 0) {
            return await createNewRound(user.id, round.roundNumber, round.games);
          } else {
            return await updateRoundGames(user.id, round.id, round.games);
          }
        })
      );

      // Update state with server response
      setRounds(updatedRoundsFromServer.filter(round => !round.isCurrent));
      setCurrentRound(updatedRoundsFromServer.find(round => round.isCurrent) || null);

    } catch (error) {
      console.error('Error updating rounds:', error);
      await fetchRounds();
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCurrentRound = async () => {
    if (!user || !currentRound) return;
    try {
      await clearCurrentRound(user.id);
      await fetchRounds();
    } catch (error) {
      console.error('Error clearing current round:', error);
    }
  };

  const moveToCurrentRound = async (roundId: number) => {
    if (!user) return;
    try {
      await updateCurrentRound(roundId);
      await fetchRounds();
    } catch (error) {
      console.error('Error moving round to current:', error);
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
          {round.games.map((game, index) => (
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