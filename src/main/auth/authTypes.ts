export interface UserAccount {
  id: string;
  type: 'microsoft' | 'offline';
  name: string;
  uuid: string;
  skinUrl: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
}

export interface AuthState {
  activeAccount: UserAccount | null;
  accounts: UserAccount[];
}
