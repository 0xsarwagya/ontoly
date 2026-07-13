export interface User {
  readonly id: string;
}

export function createUser(id: string): User {
  return { id };
}
