import React, { useState } from "react";
import { Mail, Lock, LogIn } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { cn } from "@/lib/utils";

export type SignInDemoState = "default" | "focus" | "error" | "loading";

const DEMO_EMAIL_ERROR = "E-mail jest wymagany";
const DEMO_PASSWORD_ERROR = "Hasło jest wymagane";
const DEMO_SERVER_ERROR = "Nie udało się zalogować";

interface Props {
  serverError?: string | null;
  /** Kitchen-sink only — omit on the production sign-in page. */
  demoState?: SignInDemoState;
}

export default function SignInForm({ serverError, demoState }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const showFocusRing = demoState === "focus";
  const emailError = demoState === "error" ? DEMO_EMAIL_ERROR : errors.email;
  const passwordError = demoState === "error" ? DEMO_PASSWORD_ERROR : errors.password;
  const shownServerError = demoState === "error" ? DEMO_SERVER_ERROR : serverError;

  function fieldId(field: "email" | "password") {
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
    }
  }

  return (
    <form method="POST" action="/api/auth/signin" className="space-y-4" onSubmit={handleSubmit} noValidate>
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
        placeholder="Twoje hasło"
        error={passwordError}
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

      <ServerError message={shownServerError} />

      <SubmitButton
        pending={demoState === "loading" ? true : undefined}
        pendingText="Logowanie..."
        icon={<LogIn className="size-4" />}
      >
        Zaloguj się
      </SubmitButton>
    </form>
  );
}
