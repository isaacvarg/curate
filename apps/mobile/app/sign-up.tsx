import { useRouter } from "expo-router";
import { useState } from "react";
import { Button, EmailField, ErrorText, Hint, Screen, Section, TextField } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useAuthSubmit } from "@/lib/use-auth-submit";

export default function SignUp() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { submit, submitting, error } = useAuthSubmit(() =>
    authClient.signUp.email({ name: name.trim(), email: email.trim(), password }),
  );

  return (
    <Screen>
      <Section>
        <TextField label="Name" autoComplete="name" textContentType="name" value={name} onChangeText={setName} />
        <EmailField label="Email" value={email} onChangeText={setEmail} />
        <TextField
          label="Password"
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
        />
        <Hint>At least 8 characters.</Hint>
        <ErrorText>{error}</ErrorText>
        <Button
          title={submitting ? "Creating account…" : "Create account"}
          onPress={submit}
          disabled={submitting}
        />
      </Section>
      <Button variant="text" title="Already have an account? Sign in" onPress={() => router.push("/sign-in")} />
    </Screen>
  );
}
