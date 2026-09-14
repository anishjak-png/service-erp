import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-emerald-800">
            Shop signup is closed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-slate-600">
            Companies are created from the Service ERP platform dashboard. Contact
            us if you need a shop account.
          </p>
          <p>
            <Link href="/" className="font-medium text-emerald-700 hover:underline">
              Staff sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
