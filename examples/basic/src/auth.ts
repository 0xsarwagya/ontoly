export interface User {
  readonly id: string;
  readonly email: string;
}

export function requireUser(user: User | undefined): User {
  if (!user) {
    throw new Error("Missing user");
  }

  return user;
}
