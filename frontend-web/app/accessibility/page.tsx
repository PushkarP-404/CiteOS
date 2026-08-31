export default function AccessibilityStatement() {
  return (
    <main className="flex-1 container mx-auto px-4 py-8 md:py-12 max-w-4xl font-sans text-[var(--foreground)]">
      <h1 className="text-3xl md:text-4xl font-bold mb-6 font-handwriting">Accessibility Statement</h1>
      
      <div className="space-y-6 text-sm md:text-base leading-relaxed">
        <section className="space-y-3">
          <p>
            CiteOS is committed to ensuring digital accessibility for people with disabilities. 
            We are continually improving the user experience for everyone and applying the relevant accessibility standards.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold mt-8">1. Conformance Status</h2>
          <p>
            The Web Content Accessibility Guidelines (WCAG) defines requirements for designers and developers to improve accessibility for people with disabilities. 
            It defines three levels of conformance: Level A, Level AA, and Level AAA. 
            CiteOS is partially conformant with WCAG 2.1 level AA. Partially conformant means that some parts of the content do not fully conform to the accessibility standard.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold mt-8">2. Feedback</h2>
          <p>
            We welcome your feedback on the accessibility of CiteOS. Please let us know if you encounter accessibility barriers on CiteOS:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-[var(--foreground)] opacity-90">
            <li>E-mail: accessibility@citeos.example.com</li>
          </ul>
          <p>We try to respond to feedback within 2 business days.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold mt-8">3. Technical Specifications</h2>
          <p>
            Accessibility of CiteOS relies on the following technologies to work with the particular combination of web browser and any assistive technologies or plugins installed on your computer:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-[var(--foreground)] opacity-90">
            <li>HTML</li>
            <li>WAI-ARIA</li>
            <li>CSS</li>
            <li>JavaScript</li>
          </ul>
          <p>These technologies are relied upon for conformance with the accessibility standards used.</p>
        </section>
      </div>
    </main>
  );
}
