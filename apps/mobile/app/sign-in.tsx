import { Link } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, EmailField, ErrorText, Field, formStyles } from "@/components/form";
import { authClient } from "@/lib/auth-client";
import { useAuthSubmit } from "@/lib/use-auth-submit";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { submit, submitting, error } = useAuthSubmit(() =>
    authClient.signIn.email({ email: email.trim(), password }),
  );

  return (
    <View style={formStyles.screen}>
      <EmailField value={email} onChangeText={setEmail} />
      <Field
        placeholder="Password"
        secureTextEntry
        autoComplete="current-password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
      />
      <ErrorText>{error}</ErrorText>
      <Button title={submitting ? "Signing in…" : "Sign in"} onPress={submit} disabled={submitting} />
      <Link href="/sign-up">New here? Create an account</Link>
    </View>
  );
}
