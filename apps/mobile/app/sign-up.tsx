import { Link } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, EmailField, ErrorText, Field, formStyles } from "@/components/form";
import { authClient } from "@/lib/auth-client";
import { useAuthSubmit } from "@/lib/use-auth-submit";

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { submit, submitting, error } = useAuthSubmit(() =>
    authClient.signUp.email({ name: name.trim(), email: email.trim(), password }),
  );

  return (
    <View style={formStyles.screen}>
      <Field placeholder="Name" autoComplete="name" value={name} onChangeText={setName} />
      <EmailField value={email} onChangeText={setEmail} />
      <Field
        placeholder="Password (at least 8 characters)"
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
      />
      <ErrorText>{error}</ErrorText>
      <Button
        title={submitting ? "Creating account…" : "Create account"}
        onPress={submit}
        disabled={submitting}
      />
      <Link href="/sign-in">Already have an account? Sign in</Link>
    </View>
  );
}
