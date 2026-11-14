import { Select as RadixSelect } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { Children, isValidElement, type ReactNode, type ReactElement, type OptionHTMLAttributes } from "react";

const emptyOption = "__cerne_empty_option__";

export function Select({ value, onValueChange, label, disabled, children }: {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const options = Children.toArray(children).filter((child): child is ReactElement<OptionHTMLAttributes<HTMLOptionElement>> => isValidElement<OptionHTMLAttributes<HTMLOptionElement>>(child) && child.type === "option");
  return <RadixSelect.Root value={value || emptyOption} onValueChange={(next) => onValueChange(next === emptyOption ? "" : next)} disabled={disabled}>
    <RadixSelect.Trigger className="select-trigger" aria-label={label}>
      <RadixSelect.Value />
      <RadixSelect.Icon asChild><ChevronDown /></RadixSelect.Icon>
    </RadixSelect.Trigger>
    <RadixSelect.Portal>
      <RadixSelect.Content className="ui-menu select-content" position="popper" sideOffset={4} collisionPadding={12}>
        <RadixSelect.Viewport>
          {options.map((option) => {
            const key = String(option.props.value ?? option.props.children);
            return <RadixSelect.Item key={key} className="ui-menu-item select-item" value={key || emptyOption} disabled={option.props.disabled}>
              <RadixSelect.ItemText>{option.props.children}</RadixSelect.ItemText>
              <RadixSelect.ItemIndicator><Check /></RadixSelect.ItemIndicator>
            </RadixSelect.Item>;
          })}
        </RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  </RadixSelect.Root>;
}
