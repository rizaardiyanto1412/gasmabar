import { notFound } from 'next/navigation';
import { getUserByUsername } from '@/lib/db/queries';
import AntrianComponent from '@/components/AntrianComponent';

export default async function UserPage({ params }: { params: { username: string } }) {
  console.log('UserPage: Starting to render, username:', params.username);

  try {
    const user = await getUserByUsername(params.username);
    console.log('UserPage: User data fetched:', user);

    if (!user) {
      console.log('UserPage: User not found, calling notFound()');
      notFound();
    }

    const displayName = user.name || user.email || 'Unknown User';
    console.log('UserPage: Rendering page for user:', displayName);
    
    return (
      <div>
        <h1>{displayName}'s Page</h1>
        <AntrianComponent userId={user.id} />
      </div>
    );
  } catch (error) {
    console.error('UserPage: Error occurred:', error);
    throw error;
  }
}