import { Panel } from "@/components/cards";
import { BrandingForm } from "@/components/branding-form";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <Panel
        title="White-label"
        description="Atualize logo e cores sem depender de desenvolvimento."
      >
        <BrandingForm />
      </Panel>
    </div>
  );
}
