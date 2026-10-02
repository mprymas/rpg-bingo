import React, { useState } from "react";
import { flushSync } from "react-dom";
import { Mail, Lock, UserPlus } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { cn } from "@/lib/utils";

export type SignUpDemoState = "default" | "focus" | "error" | "loading";

const MIN_PASSWORD_LENGTH = 6;
const DEMO_EMAIL_ERROR = "E-mail jest wymagany";
const DEMO_PASSWORD_ERROR = "Hasło jest wymagane";
const DEMO_CONFIRM_PASSWORD_ERROR = "Hasła nie są zgodne";
const DEMO_SERVER_ERROR = "Nie udało się założyć konta";

interface Props {
  serverError?: string | null;
  /** Kitchen-sink only — omit on the production sign-up page. */
  demoState?: SignUpDemoState;
}

export default function SignUpForm({ serverError, demoState }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(demoState === "focus" ? "abc" : "");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const showFocusRing = demoState === "focus";
  const emailError = demoState === "error" ? DEMO_EMAIL_ERROR : errors.email;
  const passwordError = demoState === "error" ? DEMO_PASSWORD_ERROR : errors.password;
  const confirmPasswordError = demoState === "error" ? DEMO_CONFIRM_PASSWORD_ERROR : errors.confirmPassword;
  const shownServerError = demoState === "error" ? DEMO_SERVER_ERROR : serverError;

  function fieldId(field: "email" | "password" | "confirmPassword") {
    return demoState ? `${field}-${demoState}` : field;
  }

  function validate() {
    const next: typeof errors = {};

    if (!email.trim()) {
      next.email = "E-mail jest wymagany";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Podaj prawidłowy adres e-mail";
    }

    if (!password) {
      next.password = "Hasło jest wymagane";
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Hasło musi mieć minimum ${MIN_PASSWORD_LENGTH} znaków`;
    }

    if (!confirmPassword) {
      next.confirmPassword = "Potwierdź hasło";
    } else if (password !== confirmPassword) {
      next.confirmPassword = "Hasła nie są zgodne";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (demoState) {
      e.preventDefault();
      return;
    }

    if (!validate()) {
      e.preventDefault();
      return;
    }

    // Paint the pending label before the browser navigates away on the native POST.
    e.preventDefault();
    flushSync(() => {
      setSubmitting(true);
    });
    e.currentTarget.submit();
  }

  const passwordHint =
    !passwordError && password.length > 0 && password.length < MIN_PASSWORD_LENGTH ? (
      <p className="text-muted-foreground mt-1 text-xs">
        Minimum {MIN_PASSWORD_LENGTH} znaków — brakuje {MIN_PASSWORD_LENGTH - password.length}
      </p>
    ) : undefined;

  return (
    <form method="POST" action="/api/auth/signup" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id={fieldId("email")}
        name="email"
        type="email"
        label="E-mail"
        value={email}
        onChange={(v) => {
          setEmail(v);
          clearError("email");
        }}
        placeholder="ty@przyklad.pl"
        error={emailError}
        autoFocus={showFocusRing}
        className={cn(showFocusRing && "border-ring ring-ring/50 ring-2")}
        icon={<Mail className="size-4" />}
      />

      <FormField
        id={fieldId("password")}
        name="password"
        label="Hasło"
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(v) => {
          setPassword(v);
          clearError("password");
        }}
        placeholder="Minimum 6 znaków"
        error={passwordError}
        hint={passwordHint}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showPassword}
            onToggle={() => {
              setShowPassword(!showPassword);
            }}
          />
        }
      />

      <FormField
        id={fieldId("confirmPassword")}
        name="confirmPassword"
        label="Potwierdź hasło"
        type={showConfirmPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(v) => {
          setConfirmPassword(v);
          clearError("confirmPassword");
        }}
        placeholder="Wpisz hasło ponownie"
        error={confirmPasswordError}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showConfirmPassword}
            onToggle={() => {
              setShowConfirmPassword(!showConfirmPassword);
            }}
          />
        }
      />

      <ServerError message={shownServerError} />

      <SubmitButton
        pending={submitting || demoState === "loading" ? true : undefined}
        pendingText="Tworzenie konta..."
        icon={<UserPlus className="size-4" />}
      >
        Załóż konto
      </SubmitButton>
    </form>
  );
}
