import { Controller, Get } from "./decorators";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("login")
  login(): string {
    return this.authService.login("demo@example.com");
  }
}
