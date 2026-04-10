export interface AuthenticatedUser {
  userId: string;
  account?: string | null;
  email?: string | null;
  nickname: string;
  personalityType?: 'I' | 'E' | null;
  isGuest: boolean;
  isAdmin: boolean;
}
