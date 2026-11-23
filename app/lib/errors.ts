import { ApiError } from "./api";
import { copy, type Lang } from "./locale";
export function errorText(lang: Lang, error: unknown) {
  const errors = copy[lang].errors;
  return error instanceof ApiError ? errors[error.message as keyof typeof errors] ?? errors.invalid : errors.unavailable;
}
