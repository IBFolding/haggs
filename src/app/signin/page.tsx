import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthForm } from "../signup/auth-form";

export const metadata: Metadata = { title: "Sign in — haggs" };

export default function SignIn() {
  return (
    <Suspense>
      <AuthForm mode="signin" />
    </Suspense>
  );
}
