import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guard";
import { getAlertSettings, getScheduleTemplates } from "@/lib/settings";
import { AlertSettingsForm } from "./alert-settings-form";
import { ScheduleTemplatesForm } from "./schedule-templates-form";

export const metadata = { title: "Settings — Kitten Tracker" };

export default async function SettingsPage() {
  await requireUser();
  const settings = getAlertSettings();
  const templates = getScheduleTemplates();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Growth alert thresholds</CardTitle>
          <CardDescription>
            Global thresholds for the growth alert engine. Changes apply on the next page load.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertSettingsForm settings={settings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vaccination & deworming schedule templates</CardTitle>
          <CardDescription>
            General guidance defaults used to suggest due dates — not a veterinary protocol. The
            shelter&apos;s and vet&apos;s actual schedule takes precedence. Ages are in weeks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduleTemplatesForm templates={templates} />
        </CardContent>
      </Card>
    </div>
  );
}
