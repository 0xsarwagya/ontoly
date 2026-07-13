export interface GreetingOptions {
  readonly name: string;
  readonly excited?: boolean;
}

export function createGreeting(options: GreetingOptions): string {
  const punctuation = options.excited ? "!" : ".";
  return `Hello, ${options.name}${punctuation}`;
}

export class GreetingService {
  greet(name: string): string {
    return createGreeting({ name, excited: true });
  }
}
