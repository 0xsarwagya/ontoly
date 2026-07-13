import { createUser } from "../../../packages/domain/src/user";

export function startApi(): string {
  return createUser("alpha").id;
}
