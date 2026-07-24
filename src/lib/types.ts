export type Role = 'user' | 'admin';

export type MissionCategory = 'social' | 'daily' | 'weekly' | 'seasonal' | 'special';
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type NotificationType =
  | 'follow'
  | 'like'
  | 'comment'
  | 'badge'
  | 'levelup'
  | 'system';

export interface Profile {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string;
  level: number;
  xp: number;
  coins: number;
  streak: number;
  last_login_date: string | null;
  frame: string;
  is_premium: boolean;
  role: Role;
  country: string;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  body: string;
  media_url: string | null;
  media_type: 'image' | 'video' | 'embed' | null;
  like_count: number;
  comment_count: number;
  repost_count: number;
  view_count: number;
  created_at: string;
  author?: Profile;
  liked_by_me?: boolean;
  reposted_by_me?: boolean;
  bookmarked_by_me?: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: Profile;
}

export interface Follow {
  id: string;
  follower_id: string;
  followed_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
  actor?: Profile | null;
}

export interface Mission {
  id: string;
  code: string;
  title_tr: string;
  title_en: string;
  description_tr: string;
  description_en: string;
  category: MissionCategory;
  target: number;
  xp_reward: number;
  coin_reward: number;
  is_active: boolean;
  created_at: string;
}

export interface UserMission {
  id: string;
  user_id: string;
  mission_id: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
  period_key: string;
  created_at: string;
  updated_at: string;
  mission?: Mission;
}

export interface Badge {
  id: string;
  code: string;
  name_tr: string;
  name_en: string;
  description_tr: string;
  description_en: string;
  icon: string;
  tier: BadgeTier;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  created_at: string;
  badge?: Badge;
}

export interface MissionWithProgress extends Mission {
  user_mission?: UserMission;
  progress: number;
  completed: boolean;
  claimed: boolean;
}
