import { redirect } from "next/navigation";
import { BrandIcon } from "@/components/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — Kitten Tracker" };

export default async function LoginPage() {
  const { session } = await getCurrentSession();
  if (session) {
    redirect("/");
  }

  return (
    <main className="bg-muted/40 flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <BrandIcon size={48} className="mx-auto mb-2 rounded-[14px]" />
          <CardTitle className="text-xl">
            <span className="text-[#1D7874]">Kitten</span>
            <span className="text-[#F2A63D]">Tracker</span>
          </CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
