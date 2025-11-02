import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { UserCard } from '@/components/UserCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Users, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  bio: string | null;
}

interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
}

interface FriendSuggestion extends Profile {
  mutualFriends: number;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadProfile(),
      loadFriends(),
      loadAllUsers(),
    ]);
    setLoading(false);
  };

  const loadProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      toast.error('Failed to load profile');
      return;
    }
    
    setProfile(data);
  };

  const loadFriends = async () => {
    if (!user) return;

    const { data: friendshipsData, error } = await supabase
      .from('friendships')
      .select('*')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (error) {
      toast.error('Failed to load friends');
      return;
    }

    const friendIds = friendshipsData.map(f => 
      f.user_id === user.id ? f.friend_id : f.user_id
    );

    if (friendIds.length === 0) {
      setFriends([]);
      return;
    }

    const { data: friendsData, error: friendsError } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', friendIds);

    if (friendsError) {
      toast.error('Failed to load friend profiles');
      return;
    }

    setFriends(friendsData || []);
  };

  const loadAllUsers = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('user_id', user.id);

    if (error) {
      toast.error('Failed to load users');
      return;
    }

    setAllUsers(data || []);
  };

  useEffect(() => {
    if (friends.length > 0 && allUsers.length > 0) {
      calculateSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [friends, allUsers]);

  const calculateSuggestions = async () => {
    if (!user) return;

    const friendIds = friends.map(f => f.user_id);
    
    // Get all friendships to calculate mutual friends
    const { data: allFriendships } = await supabase
      .from('friendships')
      .select('*');

    if (!allFriendships) return;

    const suggestionsMap = new Map<string, number>();

    // For each of my friends, find their friends
    friendIds.forEach(friendId => {
      const friendOfFriendships = allFriendships.filter(
        f => f.user_id === friendId || f.friend_id === friendId
      );

      friendOfFriendships.forEach(f => {
        const potentialFriendId = f.user_id === friendId ? f.friend_id : f.user_id;
        
        // Don't suggest yourself or existing friends
        if (potentialFriendId !== user.id && !friendIds.includes(potentialFriendId)) {
          suggestionsMap.set(
            potentialFriendId,
            (suggestionsMap.get(potentialFriendId) || 0) + 1
          );
        }
      });
    });

    // Convert to array and sort by mutual friends
    const suggestionsWithMutual: FriendSuggestion[] = Array.from(suggestionsMap.entries())
      .map(([userId, mutualCount]) => {
        const userProfile = allUsers.find(u => u.user_id === userId);
        return userProfile ? { ...userProfile, mutualFriends: mutualCount } : null;
      })
      .filter((s): s is FriendSuggestion => s !== null)
      .sort((a, b) => b.mutualFriends - a.mutualFriends);

    setSuggestions(suggestionsWithMutual);
  };

  const addFriend = async (friendId: string) => {
    if (!user) return;
    
    setActionLoading(friendId);
    
    const { error } = await supabase
      .from('friendships')
      .insert([
        { user_id: user.id, friend_id: friendId },
        { user_id: friendId, friend_id: user.id }, // Bidirectional friendship
      ]);

    if (error) {
      toast.error('Failed to add friend');
    } else {
      toast.success('Friend added successfully!');
      await loadData();
    }
    
    setActionLoading(null);
  };

  const removeFriend = async (friendId: string) => {
    if (!user) return;
    
    setActionLoading(friendId);
    
    const { error } = await supabase
      .from('friendships')
      .delete()
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);

    if (error) {
      toast.error('Failed to remove friend');
    } else {
      toast.success('Friend removed');
      await loadData();
    }
    
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary">
      <header className="bg-card border-b border-border sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Social Network</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                Welcome, <span className="font-semibold text-foreground">{profile?.name}</span>
              </span>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <Tabs defaultValue="suggestions" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="suggestions" className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Suggestions
            </TabsTrigger>
            <TabsTrigger value="friends" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Friends
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              All Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Friend Suggestions</CardTitle>
                <CardDescription>
                  People you may know based on mutual friends
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {suggestions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No suggestions available. Add some friends to get personalized suggestions!
                  </p>
                ) : (
                  suggestions.map(suggestion => (
                    <UserCard
                      key={suggestion.id}
                      id={suggestion.user_id}
                      name={suggestion.name}
                      email={suggestion.email}
                      mutualFriends={suggestion.mutualFriends}
                      onAddFriend={() => addFriend(suggestion.user_id)}
                      loading={actionLoading === suggestion.user_id}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="friends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Friends ({friends.length})</CardTitle>
                <CardDescription>
                  People you're connected with
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {friends.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    You haven't added any friends yet. Check out the All Users tab!
                  </p>
                ) : (
                  friends.map(friend => (
                    <UserCard
                      key={friend.id}
                      id={friend.user_id}
                      name={friend.name}
                      email={friend.email}
                      isFriend
                      onRemoveFriend={() => removeFriend(friend.user_id)}
                      loading={actionLoading === friend.user_id}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Users ({allUsers.length})</CardTitle>
                <CardDescription>
                  Browse all members of the network
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {allUsers.map(otherUser => {
                  const isFriend = friends.some(f => f.user_id === otherUser.user_id);
                  return (
                    <UserCard
                      key={otherUser.id}
                      id={otherUser.user_id}
                      name={otherUser.name}
                      email={otherUser.email}
                      isFriend={isFriend}
                      onAddFriend={() => addFriend(otherUser.user_id)}
                      onRemoveFriend={() => removeFriend(otherUser.user_id)}
                      loading={actionLoading === otherUser.user_id}
                    />
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
