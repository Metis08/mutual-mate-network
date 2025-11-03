import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { UserCard } from '@/components/UserCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/ThemeToggle';
import { GraphVisualization } from '@/components/GraphVisualization';
import { LogOut, Users, UserPlus, Sparkles } from 'lucide-react';
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
  const [showTraversal, setShowTraversal] = useState(false);
  const [traversalLogs, setTraversalLogs] = useState<string[]>([]);
  const [allFriendships, setAllFriendships] = useState<Friendship[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

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
      loadAllFriendships(),
    ]);
    setLoading(false);
  };

  const loadAllFriendships = async () => {
    const { data, error } = await supabase
      .from('friendships')
      .select('*');

    if (error) {
      toast.error('Failed to load friendships');
      return;
    }

    setAllFriendships(data || []);
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

    const logs: string[] = [];
    logs.push(`🚀 Starting BFS traversal for user: ${profile?.name || user.id}`);
    
    const friendIds = friends.map(f => f.user_id);
    logs.push(`📊 Current friends: ${friends.length} total`);
    
    if (allFriendships.length === 0) return;

    const suggestionsMap = new Map<string, number>();
    logs.push(`\n🔍 Traversing friend network...`);

    // For each of my friends, find their friends (BFS Level 1)
    friendIds.forEach((friendId, index) => {
      const friend = friends.find(f => f.user_id === friendId);
      logs.push(`\n👤 Visiting node: ${friend?.name || friendId} (Friend ${index + 1}/${friendIds.length})`);
      
      const friendOfFriendships = allFriendships.filter(
        f => f.user_id === friendId || f.friend_id === friendId
      );

      logs.push(`  → Checking ${friendOfFriendships.length} connections...`);

      friendOfFriendships.forEach(f => {
        const potentialFriendId = f.user_id === friendId ? f.friend_id : f.user_id;
        const potentialFriend = allUsers.find(u => u.user_id === potentialFriendId);
        
        // Don't suggest yourself or existing friends
        if (potentialFriendId !== user.id && !friendIds.includes(potentialFriendId)) {
          const currentCount = suggestionsMap.get(potentialFriendId) || 0;
          suggestionsMap.set(potentialFriendId, currentCount + 1);
          logs.push(`  ✨ Found mutual connection: ${potentialFriend?.name || potentialFriendId} (${currentCount + 1} mutual)`);
        }
      });
    });

    logs.push(`\n✅ Traversal complete!`);
    logs.push(`📈 Found ${suggestionsMap.size} potential friends`);

    // Convert to array and sort by mutual friends
    const suggestionsWithMutual: FriendSuggestion[] = Array.from(suggestionsMap.entries())
      .map(([userId, mutualCount]) => {
        const userProfile = allUsers.find(u => u.user_id === userId);
        return userProfile ? { ...userProfile, mutualFriends: mutualCount } : null;
      })
      .filter((s): s is FriendSuggestion => s !== null)
      .sort((a, b) => b.mutualFriends - a.mutualFriends);

    logs.push(`\n🎯 Top suggestions ranked by mutual connections:`);
    suggestionsWithMutual.slice(0, 5).forEach((s, i) => {
      logs.push(`  ${i + 1}. ${s.name} - ${s.mutualFriends} mutual friend${s.mutualFriends > 1 ? 's' : ''}`);
    });

    setSuggestions(suggestionsWithMutual);
    setTraversalLogs(logs);
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
      <div className="min-h-screen flex items-center justify-center bg-background transition-colors">
        <div className="text-center animate-fade-in">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto glow-effect"></div>
          <p className="mt-4 text-muted-foreground">loading vibes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <Card className="glass-card shadow-card interactive-scale">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-effect">
                  <Sparkles className="w-7 h-7 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-3xl font-bold gradient-text">
                    vibes & connections
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    hey {profile?.name} ✨
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Button onClick={signOut} variant="outline" size="sm" className="interactive-scale">
                  <LogOut className="w-4 h-4 mr-2" />
                  peace out
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Main Content */}
        <Tabs defaultValue="suggestions" className="w-full">
          <TabsList className="grid w-full grid-cols-3 glass-card p-1">
            <TabsTrigger value="suggestions" className="interactive-scale data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground">
              <UserPlus className="w-4 h-4 mr-2" />
              for you ({suggestions.length})
            </TabsTrigger>
            <TabsTrigger value="friends" className="interactive-scale data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground">
              <Users className="w-4 h-4 mr-2" />
              squad ({friends.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="interactive-scale data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground">
              <Users className="w-4 h-4 mr-2" />
              everyone ({allUsers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions" className="space-y-4">
            <Card className="glass-card shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">✨ suggested connections</CardTitle>
                    <CardDescription>
                      people with mutual vibes
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Show Graph</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newState = !showTraversal;
                          setShowTraversal(newState);
                          if (newState) {
                            setIsAnimating(true);
                            setTimeout(() => setIsAnimating(false), 10000);
                          } else {
                            setIsAnimating(false);
                          }
                        }}
                        className={showTraversal ? "bg-primary text-primary-foreground" : ""}
                      >
                        {showTraversal ? "ON" : "OFF"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              {showTraversal && (
                <CardContent className="mb-4 space-y-4">
                  <div className="animate-fade-in">
                    <h3 className="text-sm font-semibold mb-2 text-primary">Live Graph Traversal</h3>
                    <GraphVisualization
                      currentUserId={user?.id || ''}
                      friends={friends}
                      allUsers={allUsers}
                      friendships={allFriendships}
                      isAnimating={isAnimating}
                    />
                  </div>
                  
                  {traversalLogs.length > 0 && (
                    <div className="glass-card border border-primary/20 rounded-lg p-4 max-h-60 overflow-y-auto">
                      <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Traversal Log</h3>
                      <div className="font-mono text-xs space-y-1">
                        {traversalLogs.map((log, index) => (
                          <div 
                            key={index} 
                            className={`animate-fade-in ${log.includes('✨') ? 'text-primary' : log.includes('✅') ? 'text-success' : 'text-foreground/80'}`}
                            style={{ animationDelay: `${index * 0.05}s` }}
                          >
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
              
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {suggestions.length === 0 ? (
                  <p className="text-muted-foreground col-span-full text-center py-12">
                    no suggestions rn. start connecting with people! 🚀
                  </p>
                ) : (
                  suggestions.map(suggestion => (
                    <div key={suggestion.id} className="animate-scale-in">
                      <UserCard
                        id={suggestion.user_id}
                        name={suggestion.name}
                        email={suggestion.email}
                        mutualFriends={suggestion.mutualFriends}
                        onAddFriend={() => addFriend(suggestion.user_id)}
                        loading={actionLoading === suggestion.user_id}
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="friends" className="space-y-4">
            <Card className="glass-card shadow-card">
              <CardHeader>
                <CardTitle className="text-xl">💫 your squad</CardTitle>
                <CardDescription>
                  the real ones
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {friends.length === 0 ? (
                  <p className="text-muted-foreground col-span-full text-center py-12">
                    no friends yet? let's change that! check out everyone tab 👀
                  </p>
                ) : (
                  friends.map(friend => (
                    <div key={friend.id} className="animate-scale-in">
                      <UserCard
                        id={friend.user_id}
                        name={friend.name}
                        email={friend.email}
                        isFriend
                        onRemoveFriend={() => removeFriend(friend.user_id)}
                        loading={actionLoading === friend.user_id}
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            <Card className="glass-card shadow-card">
              <CardHeader>
                <CardTitle className="text-xl">🌐 everyone</CardTitle>
                <CardDescription>
                  explore & connect
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allUsers.map(otherUser => {
                  const isFriend = friends.some(f => f.user_id === otherUser.user_id);
                  return (
                    <div key={otherUser.id} className="animate-scale-in">
                      <UserCard
                        id={otherUser.user_id}
                        name={otherUser.name}
                        email={otherUser.email}
                        isFriend={isFriend}
                        onAddFriend={() => addFriend(otherUser.user_id)}
                        onRemoveFriend={() => removeFriend(otherUser.user_id)}
                        loading={actionLoading === otherUser.user_id}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
