import { useRouter } from "expo-router";
import { useState } from "react";
import { Button, EmailField, ErrorText, Screen, Section, TextField } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useAuthSubmit } from "@/lib/use-auth-submit";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { submit, submitting, error } = useAuthSubmit(() =>
    authClient.signIn.email({ email: email.trim(), password }),
  );

  return (
    <Screen>
      <Section>
        <EmailField label="Email" value={email} onChangeText={setEmail} />
        <TextField
          label="Password"
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
        />
        <ErrorText>{error}</ErrorText>
        <Button title={submitting ? "Signing in…" : "Sign in"} onPress={submit} disabled={submitting} />
      </Section>
      <Button variant="text" title="New here? Create an account" onPress={() => router.push("/sign-up")} />
    </Screen>
  );
}
