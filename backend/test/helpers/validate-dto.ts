import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
export async function errorsFor<T extends object>(
  cls: new () => T,
  plain: object,
) {
  const instance = plainToInstance(cls, plain);
  const errors = await validate(instance);
  function flat(error: ValidationError): string[] {
    return [
      ...Object.keys(error.constraints ?? {}).map(
        (key) => `${error.property}.${key}`,
      ),
      ...(error.children ?? []).flatMap((child) =>
        flat(child).map((path) => `${error.property}.${path}`),
      ),
    ];
  }
  return errors.flatMap(flat);
}
