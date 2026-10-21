import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

/** "Only show differences" for a static comparison table (rows marked .same are hidden). */
export function DiffSwitch({ target }: { target: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="diff-only"
        checked={on}
        onCheckedChange={(v) => {
          setOn(v);
          document.querySelector(target)?.classList.toggle('only-diff', v);
        }}
      />
      <Label htmlFor="diff-only">Only show differences</Label>
    </div>
  );
}
