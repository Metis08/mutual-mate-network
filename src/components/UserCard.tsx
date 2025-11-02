import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12 bg-primary/10">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{name}</h3>
          <p className="text-sm text-muted-foreground truncate">{email}</p>
          {mutualFriends !== undefined && mutualFriends > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Users className="w-3 h-3" />
              <span>{mutualFriends} mutual friend{mutualFriends > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
        {isFriend ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onRemoveFriend}
            disabled={loading}
            className="shrink-0"
          >
            <UserMinus className="w-4 h-4 mr-2" />
            Unfriend
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onAddFriend}
            disabled={loading}
            className="shrink-0"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Friend
          </Button>
        )}
      </div>
    </Card>
  );
};
