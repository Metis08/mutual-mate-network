import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserPlus, UserMinus, Users } from 'lucide-react';

interface UserCardProps {
  id: string;
  name: string;
  email: string;
  isFriend?: boolean;
  mutualFriends?: number;
  onAddFriend?: () => void;
  onRemoveFriend?: () => void;
  loading?: boolean;
}

export const UserCard = ({ 
  name, 
  email, 
  isFriend, 
  mutualFriends, 
  onAddFriend, 
  onRemoveFriend,
  loading 
}: UserCardProps) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="glass-card overflow-hidden hover:shadow-glow transition-all duration-300 interactive-scale group">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-14 h-14 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg truncate">{name}</h3>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </div>
      </CardHeader>
      
      {mutualFriends !== undefined && mutualFriends > 0 && (
        <CardContent className="pb-3">
          <Badge variant="secondary" className="w-full justify-center gap-2 py-2">
            <Users className="w-3 h-3" />
            <span>{mutualFriends} mutual vibe{mutualFriends !== 1 ? 's' : ''}</span>
          </Badge>
        </CardContent>
      )}

      <CardFooter>
        {isFriend ? (
          <Button
            onClick={onRemoveFriend}
            variant="outline"
            className="w-full interactive-scale"
            disabled={loading}
          >
            <UserMinus className="w-4 h-4 mr-2" />
            unfriend
          </Button>
        ) : (
          <Button
            onClick={onAddFriend}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 interactive-scale"
            disabled={loading}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            add friend
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
