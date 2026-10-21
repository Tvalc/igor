import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Tool } from '@/lib/score';
import type { FeatureDef } from '@/lib/features';
import { FeatureMark } from './FeatureMark';
import { ToolLogo } from './ToolLogo';

export function FeatureMatrix({ tools, defs }: { tools: Tool[]; defs: FeatureDef[] }) {
  // Only rows someone has data for, so the table shows what we know rather than a wall of question marks.
  const rows = defs.filter((f) => tools.some((t) => t.data.features[f.key] !== undefined));
  if (!rows.length) return null;
  return (
    <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="min-w-44">Feature</TableHead>
            {tools.map((t) => (
              <TableHead key={t.id}>
                <a href={`/tools/${t.id}`} className="text-foreground inline-flex items-center gap-2 hover:underline">
                  <ToolLogo name={t.data.name} url={t.data.url} size="sm" />
                  {t.data.name}
                </a>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((f) => (
            <TableRow key={f.key}>
              <TableCell className="font-medium">{f.label}</TableCell>
              {tools.map((t) => (
                <TableCell key={t.id}>
                  <FeatureMark value={t.data.features[f.key]} note={t.data.feature_notes[f.key]} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
