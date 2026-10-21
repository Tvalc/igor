import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function Faq({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <section className="mt-14">
      <h2 className="mb-4 text-2xl font-semibold">Frequently asked questions</h2>
      <Accordion className="bg-card rounded-xl border px-5 shadow-sm">
        {faqs.map((f, i) => (
          <AccordionItem key={f.q} open={i === 0}>
            <AccordionTrigger className="text-[15px]">{f.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
