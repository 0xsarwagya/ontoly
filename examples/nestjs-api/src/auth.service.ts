import { Injectable } from "./decorators";

@Injectable()
export class AuthService {
  login(email: string): string {
    return `session:${email}`;
  }
}
