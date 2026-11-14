import { Switch as RadixSwitch } from "radix-ui";

export function Switch({ checked, onChange, disabled, label }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return <label className="switch-label">
    <RadixSwitch.Root type="button" className="ui-switch" aria-label={label} checked={checked} onCheckedChange={onChange} disabled={disabled}>
      <RadixSwitch.Thumb className="ui-switch-thumb" />
    </RadixSwitch.Root>
    {label}
  </label>;
}
