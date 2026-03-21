export interface DemoUser {
  id: string;
  username: string;
  display_name: string;
  avatar_emoji: string;
  color: string;
}

export const DEMO_USERS: DemoUser[] = [
  {
    id: '00000000-0000-0000-0000-000000000200',
    username: 'fabian',
    display_name: 'Fabian',
    avatar_emoji: '🦁',
    color: '#E8593C',
  },
  {
    id: '00000000-0000-0000-0000-000000000201',
    username: 'taro',
    display_name: 'Taro',
    avatar_emoji: '🐉',
    color: '#7F77DD',
  },
  {
    id: '00000000-0000-0000-0000-000000000202',
    username: 'dylan',
    display_name: 'Dylan',
    avatar_emoji: '🦅',
    color: '#1D9E75',
  },
  {
    id: '00000000-0000-0000-0000-000000000203',
    username: 'ethan',
    display_name: 'Ethan',
    avatar_emoji: '🐺',
    color: '#378ADD',
  },
];

// Backwards-compatible default export
export const DEMO_USER = DEMO_USERS[0];
