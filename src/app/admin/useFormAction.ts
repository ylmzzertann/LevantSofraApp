"use client";

import { useActionState, useEffect, useRef, useTransition, type FormEvent } from "react";

type Action = (prev: string | null, form: FormData) => Promise<string | null>;

/**
 * Runs a server action from a form without React 19's automatic form reset.
 *
 * `<form action={…}>` clears every uncontrolled field once the action returns —
 * including when it returns a validation error. So "that id is already taken"
 * used to arrive with the whole dish form wiped, and a mistyped password took
 * the email with it. Submitting through `onSubmit` keeps what was typed, and
 * `onSuccess` decides what happens to the form only when the save really worked.
 */
export function useFormAction(action: Action, onSuccess?: (form: HTMLFormElement) => void) {
  const [error, run, pending] = useActionState(action, null);
  const [, startTransition] = useTransition();
  const form = useRef<HTMLFormElement | null>(null);
  const waiting = useRef(false);
  const successRef = useRef(onSuccess);
  successRef.current = onSuccess;

  useEffect(() => {
    if (!waiting.current || pending) return;
    waiting.current = false;
    if (error === null && form.current) successRef.current?.(form.current);
  }, [pending, error]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    form.current = event.currentTarget;
    const data = new FormData(event.currentTarget);
    waiting.current = true;
    startTransition(() => run(data));
  };

  return { error, pending, onSubmit };
}
