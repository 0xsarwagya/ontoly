type ClassDecoratorFactory = (target: Function) => void;
type MethodDecoratorFactory = (target: unknown, propertyKey: string | symbol) => void;

export function Controller(_path = ""): ClassDecoratorFactory {
  return () => undefined;
}

export function Module(_metadata: unknown): ClassDecoratorFactory {
  return () => undefined;
}

export function Injectable(): ClassDecoratorFactory {
  return () => undefined;
}

export function Get(_path = ""): MethodDecoratorFactory {
  return () => undefined;
}
