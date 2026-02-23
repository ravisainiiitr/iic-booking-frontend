import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Mail, Phone, Building2 } from 'lucide-react';

interface UserProfileProps {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  profilePicture?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showPhone?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: {
    avatar: 'h-8 w-8',
    text: 'text-sm',
    icon: 'h-3 w-3',
  },
  md: {
    avatar: 'h-10 w-10',
    text: 'text-base',
    icon: 'h-4 w-4',
  },
  lg: {
    avatar: 'h-12 w-12',
    text: 'text-lg',
    icon: 'h-5 w-5',
  },
};

const UserProfile: React.FC<UserProfileProps> = ({
  name,
  email,
  phone,
  department,
  profilePicture,
  size = 'md',
  showPhone = true,
  className = '',
}) => {
  const sizes = sizeClasses[size];
  const displayName = name || email || 'Unknown User';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Avatar className={sizes.avatar}>
        <AvatarImage src={profilePicture || undefined} alt={displayName} />
        <AvatarFallback className={sizes.text}>
          {initials || 'U'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${sizes.text} truncate`}>{displayName}</p>
        {email && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Mail className={sizes.icon} />
            <span className={`${sizes.text} truncate`}>{email}</span>
          </div>
        )}
        {department && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Building2 className={sizes.icon} />
            <span className={`${sizes.text} truncate`}>{department}</span>
          </div>
        )}
        {showPhone && phone && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Phone className={sizes.icon} />
            <span className={`${sizes.text} truncate`}>{phone}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
