import { UserService } from "./service";

const service = new UserService();

export function main() {
  return service.load({ id: "user_1", email: "user@example.com" });
}
