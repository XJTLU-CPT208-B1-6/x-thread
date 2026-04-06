export interface AuthenticatedUser {
  userId: string;
  account?: string | null;
  email?: string | null;
  nickname: string;
  isGuest: boolean;
  isAdmin: boolean;
}
