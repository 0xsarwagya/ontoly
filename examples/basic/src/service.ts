import { requireUser, type User } from "./auth";

export class UserService {
  load(currentUser: User | undefined): User {
    return requireUser(currentUser);
  }
}
