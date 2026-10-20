import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthForm } from "./auth-form";

export const metadata: Metadata = { title: "Sign up — haggs" };

export default function SignUp() {
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
